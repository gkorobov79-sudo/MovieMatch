import os
import requests
import time
import urllib3

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

session = requests.Session()
session.trust_env = True

load_dotenv()

app = FastAPI()


# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# TMDB
# =========================

TMDB_TOKEN = os.getenv("TMDB_TOKEN")


# =========================
# МОДЕЛЬ ЗАПРОСА
# =========================

class RecommendationRequest(BaseModel):
    movie_ids: list[int]


# =========================
# ВСПОМОГАТЕЛЬНЫЙ ЗАПРОС К TMDB
# =========================

def tmdb_get(url, params=None):

    for attempt in range(3):

        try:

            response = session.get(
                url,
                params=params,
                headers={
                    "Authorization": f"Bearer {TMDB_TOKEN}",
                    "accept": "application/json"
                },
                verify=False,
                timeout=15
            )

            if response.status_code == 200:
                return response

            print(
                f"TMDB error {response.status_code}. "
                f"Попытка {attempt + 1}/3"
            )

        except requests.RequestException as error:

            print(
                f"Ошибка соединения с TMDB: {error}. "
                f"Попытка {attempt + 1}/3"
            )

            time.sleep(1)

    return None


# =========================
# ПРОВЕРКА BACKEND
# =========================

@app.get("/")
def home():

    return {
        "message": "MovieMatch backend is working!"
    }


# =========================
# ПОИСК ФИЛЬМОВ
# =========================

@app.get("/search")
def search_movie(movie: str):

    response = tmdb_get(
        "https://api.themoviedb.org/3/search/movie",
        params={
            "query": movie,
            "language": "ru-RU"
        }
    )

    if response is None:

        return {
            "error": "Не удалось подключиться к TMDB"
        }

    return response.json()


# =========================
# ПОСТЕР
# =========================

@app.get("/poster")
def get_poster(path: str):

    if not path:

        return Response(
            status_code=404
        )

    for attempt in range(3):

        try:

            response = session.get(
                f"https://image.tmdb.org/t/p/w342{path}",
                verify=False,
                timeout=15
            )

            if response.status_code == 200:

                return Response(
                    content=response.content,
                    media_type=response.headers.get(
                        "content-type",
                        "image/jpeg"
                    )
                )

            print(
                f"Ошибка загрузки постера: "
                f"{response.status_code}. "
                f"Попытка {attempt + 1}/3"
            )

        except requests.RequestException as error:

            print(
                f"Ошибка соединения с image.tmdb.org: "
                f"{error}. "
                f"Попытка {attempt + 1}/3"
            )

            time.sleep(1)

    return Response(
        status_code=502
    )


# =========================
# ПОЛУЧЕНИЕ ДЕТАЛЕЙ ФИЛЬМА
# =========================

def get_movie_details(movie_id):

    response = tmdb_get(
        f"https://api.themoviedb.org/3/movie/{movie_id}",
        params={
            "language": "ru-RU"
        }
    )

    if response is None:
        return None

    return response.json()


# =========================
# ПОЛУЧЕНИЕ KEYWORDS
# =========================

def get_movie_keywords(movie_id):

    response = tmdb_get(
        f"https://api.themoviedb.org/3/movie/{movie_id}/keywords"
    )

    if response is None:
        return set()

    data = response.json()

    return {
        keyword["name"].lower()
        for keyword in data.get("keywords", [])
    }


# =========================
# ПОЛУЧЕНИЕ АКТЁРОВ
# =========================

def get_movie_actors(movie_id):

    response = tmdb_get(
        f"https://api.themoviedb.org/3/movie/{movie_id}/credits"
    )

    if response is None:
        return set()

    data = response.json()

    actors = data.get("cast", [])[:10]

    return {
        actor["id"]
        for actor in actors
    }


# =========================
# СОВПАДЕНИЕ ЖАНРОВ
# =========================

def calculate_genre_score(
    candidate_genres,
    selected_genres
):

    if not candidate_genres or not selected_genres:

        return 0

    candidate = set(candidate_genres)

    selected = set(selected_genres)

    intersection = candidate & selected

    union = candidate | selected

    if not union:
        return 0

    return len(intersection) / len(union)


# =========================
# СОВПАДЕНИЕ KEYWORDS
# =========================

def calculate_keyword_score(
    candidate_keywords,
    selected_keywords
):

    if not candidate_keywords or not selected_keywords:

        return 0

    intersection = (
        candidate_keywords &
        selected_keywords
    )

    union = (
        candidate_keywords |
        selected_keywords
    )

    if not union:
        return 0

    return len(intersection) / len(union)


# =========================
# СОВПАДЕНИЕ АКТЁРОВ
# =========================

def calculate_actor_score(
    candidate_actors,
    selected_actors
):

    if not candidate_actors or not selected_actors:

        return 0

    intersection = (
        candidate_actors &
        selected_actors
    )

    return min(
        len(intersection) / 2,
        1
    )

@app.post("/recommend")
def recommend_movies(data: RecommendationRequest):

    # =========================
    # ПРОВЕРКА
    # =========================

    if len(data.movie_ids) != 3:
        return {
            "error": "Нужно выбрать ровно 3 фильма"
        }

    selected_ids = data.movie_ids

    print("Начинаем подбор рекомендаций...")
    print("Выбранные фильмы:", selected_ids)


    # =========================
    # ПОЛУЧАЕМ ЖАНРЫ 3 ФИЛЬМОВ
    # =========================

    selected_movies = []

    for movie_id in selected_ids:

        details = get_movie_details(movie_id)

        if details is None:
            continue

        genres = {
            genre["id"]
            for genre in details.get("genres", [])
        }

        selected_movies.append({
            "id": movie_id,
            "genres": genres
        })


    if not selected_movies:
        return {
            "error": "Не удалось получить данные выбранных фильмов"
        }


    # =========================
    # СОБИРАЕМ КАНДИДАТОВ
    # =========================

    candidates = {}


    for movie_id in selected_ids:

        # -------------------------
        # RECOMMENDATIONS
        # -------------------------

        response = tmdb_get(
            f"https://api.themoviedb.org/3/movie/{movie_id}/recommendations",
            params={
                "language": "ru-RU",
                "page": 1
            }
        )

        if response is not None:

            movies = response.json().get(
                "results",
                []
            )

            for movie in movies:

                candidate_id = movie["id"]

                if candidate_id in selected_ids:
                    continue

                if candidate_id not in candidates:

                    candidates[candidate_id] = {
                        "movie": movie,
                        "sources": set()
                    }

                candidates[candidate_id]["sources"].add(
                    movie_id
                )


        # -------------------------
        # SIMILAR
        # -------------------------

        response = tmdb_get(
            f"https://api.themoviedb.org/3/movie/{movie_id}/similar",
            params={
                "language": "ru-RU",
                "page": 1
            }
        )

        if response is not None:

            movies = response.json().get(
                "results",
                []
            )

            for movie in movies:

                candidate_id = movie["id"]

                if candidate_id in selected_ids:
                    continue

                if candidate_id not in candidates:

                    candidates[candidate_id] = {
                        "movie": movie,
                        "sources": set()
                    }

                candidates[candidate_id]["sources"].add(
                    movie_id
                )


    print(
        "Всего кандидатов:",
        len(candidates)
    )


    # =========================
    # ОЦЕНИВАЕМ КАНДИДАТОВ
    # =========================

    scored_movies = []


    for candidate_id, candidate_data in candidates.items():

        movie = candidate_data["movie"]

        candidate_genres = set(
            movie.get("genre_ids", [])
        )

        if not candidate_genres:
            continue


        # -------------------------
        # СРАВНИВАЕМ С 3 ФИЛЬМАМИ
        # -------------------------

        pair_scores = []


        for selected in selected_movies:

            # ЖАНРЫ — 55%
            genre_score = calculate_genre_score(
                candidate_genres,
                selected["genres"]
            )


            # Похожесть через TMDB — 30%
            #
            # Если кандидат был найден
            # среди рекомендаций или похожих
            # для этого фильма

            source_score = (
                1
                if selected["id"]
                in candidate_data["sources"]
                else 0
            )


            # РЕЙТИНГ — 10%

            rating = movie.get(
                "vote_average",
                0
            )

            rating_score = min(
                rating / 10,
                1
            )


            # ПОПУЛЯРНОСТЬ — 5%
            #
            # Ограничиваем её, чтобы
            # популярный фильм не ломал
            # весь алгоритм.

            popularity = movie.get(
                "popularity",
                0
            )

            popularity_score = min(
                popularity / 100,
                1
            )


            # =========================
            # SCORE
            # =========================

            score = (

                genre_score * 0.55

                +

                source_score * 0.30

                +

                rating_score * 0.10

                +

                popularity_score * 0.05

            )


            pair_scores.append(score)


        if not pair_scores:
            continue


        # =========================
        # ДВА ЛУЧШИХ СОВПАДЕНИЯ
        # =========================

        pair_scores.sort(
            reverse=True
        )


        if len(pair_scores) >= 2:

            best_two_average = (
                pair_scores[0]
                +
                pair_scores[1]
            ) / 2

            all_three_average = (
                sum(pair_scores)
                /
                len(pair_scores)
            )


            # Главный принцип:
            #
            # фильм может подходить
            # хотя бы двум из трёх.

            final_score = (

                best_two_average * 0.75

                +

                all_three_average * 0.25

            )

        else:

            final_score = pair_scores[0]


        # =========================
        # МИНИМАЛЬНЫЙ ПОРОГ
        # =========================

        if final_score < 0.30:
            continue


        scored_movies.append({

            "movie": movie,

            "match_score": round(
                final_score * 100
            )

        })


    # =========================
    # СОРТИРОВКА
    # =========================

    scored_movies.sort(
        key=lambda item:
        item["match_score"],
        reverse=True
    )


    print(
        "Подходящих фильмов:",
        len(scored_movies)
    )


    # =========================
    # TOP 5
    # =========================

    result = []


    for item in scored_movies[:5]:

        movie = item["movie"]

        result.append({

            "id": movie["id"],

            "title": movie.get(
                "title"
            ),

            "release_date": movie.get(
                "release_date"
            ),

            "overview": movie.get(
                "overview"
            ),

            "vote_average": movie.get(
                "vote_average"
            ),

            "poster_path": movie.get(
                "poster_path"
            ),

            "match_score": item[
                "match_score"
            ]

        })


    print(
        "Рекомендации готовы:",
        len(result)
    )


    return {
        "recommendations": result
    }