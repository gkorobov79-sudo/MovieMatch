console.log("MovieMatch JS WORK");

function updateRecommendButton() {

    const movie1 = document.getElementById("movie1");
    const movie2 = document.getElementById("movie2");
    const movie3 = document.getElementById("movie3");

    const button =
        document.getElementById("recommendButton");

    const counter =
        document.getElementById("selectedCount");


    // Считаем выбранные фильмы

    let selectedCount = 0;

    if (movie1.dataset.movieId) {
        selectedCount++;
    }

    if (movie2.dataset.movieId) {
        selectedCount++;
    }

    if (movie3.dataset.movieId) {
        selectedCount++;
    }


    // Обновляем счётчик

    counter.textContent = selectedCount;


    // Показываем кнопку только после
    // выбора всех трёх фильмов

    if (selectedCount === 3) {

        button.style.display = "block";

    } else {

        button.style.display = "none";
    }
}

// ===============================
// ПОИСК ФИЛЬМОВ
// ===============================

function setupMovieSearch(inputId, resultsId) {

    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);

    let searchId = 0;
    let controller = null;

    input.addEventListener("input", async function () {

        const query = input.value.trim();

        // Новый поиск
        searchId++;
        const currentSearchId = searchId;

        // Отменяем предыдущий запрос
        if (controller) {
            controller.abort();
        }

        // Создаём контроллер для нового запроса
        controller = new AbortController();

        // Пользователь снова печатает —
        // старый фильм больше не выбран
        delete input.dataset.movieId;

        updateRecommendButton();

        // Если текста мало — очищаем результаты
        if (query.length < 2) {
            results.innerHTML = "";
            return;
        }

        try {

            const response = await fetch(
                `"https://moviematch-8yak.onrender.com/search?movie=${encodeURIComponent(query)}`,
                {
                    signal: controller.signal
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Ошибка сервера: ${response.status}`
                );
            }

            const data = await response.json();

            // Если это уже не последний запрос —
            // ничего не делаем
            if (currentSearchId !== searchId) {
                return;
            }

            // Очищаем старые результаты
            results.innerHTML = "";

            if (!data.results || data.results.length === 0) {

                results.innerHTML = `
                    <p>Фильмы не найдены</p>
                `;

                return;
            }

            // Показываем максимум 5 фильмов
            data.results.slice(0, 5).forEach(function (movie) {

                const movieElement =
                    document.createElement("div");

                movieElement.className = "search-result";

                const poster = movie.poster_path
                    ? `http://127.0.0.1:8000/poster?path=${encodeURIComponent(movie.poster_path)}`
                    : "";

                movieElement.innerHTML = `
                    ${
                        poster
                            ? `
                                <img
                                    src="${poster}"
                                    alt="${movie.title || "Фильм"}"
                                >
                            `
                            : `
                                <div class="search-no-poster">
                                    🎬
                                </div>
                            `
                    }
                
                    <div class="search-result-info">
                
                        <strong>
                            ${movie.title || "Без названия"}
                        </strong>
                
                        <small>
                            ${
                                movie.release_date
                                    ? movie.release_date.substring(0, 4)
                                    : "Год неизвестен"
                            }
                        </small>
                
                    </div>
                `;



                // ===============================
                // ВЫБОР ФИЛЬМА
                // ===============================

                movieElement.addEventListener(
                    "mousedown",
                    function (event) {

                        // Не даём браузеру сначала
                        // сделать лишние действия с input
                        event.preventDefault();

                        // Увеличиваем ID поиска,
                        // чтобы старые ответы игнорировались
                        searchId++;

                        // Отменяем запрос
                        if (controller) {
                            controller.abort();
                        }

                        // Записываем выбранный фильм
                        input.value = movie.title;

                        // Сохраняем ID TMDB
                        input.dataset.movieId = movie.id;

                        // Сохраняем данные фильма
                        input.dataset.movieTitle = movie.title || "";
                        input.dataset.movieYear =
                            movie.release_date
                                ? movie.release_date.substring(0, 4)
                                : "";
                        input.dataset.moviePoster = movie.poster_path || "";

                        // Показываем выбранный фильм
                        showSelectedMovie(input, movie);

                        // СРАЗУ очищаем результаты
                        results.innerHTML = "";

                        updateRecommendButton();

                        console.log(
                            `Выбран фильм: ${movie.title}, ID: ${movie.id}`
                        );
                    }
                );

                results.appendChild(movieElement);
            });

        } catch (error) {

            // Отмена запроса — это не ошибка
            if (error.name === "AbortError") {
                return;
            }

            console.error(
                "Ошибка поиска:",
                error
            );

            results.innerHTML = `
                <p>Не удалось выполнить поиск</p>
            `;
        }
    });
}


// ===============================
// ТРИ ПОЛЯ ПОИСКА
// ===============================

setupMovieSearch(
    "movie1",
    "searchResults1"
);

setupMovieSearch(
    "movie2",
    "searchResults2"
);

setupMovieSearch(
    "movie3",
    "searchResults3"
);


// ===============================
// ПОЛУЧЕНИЕ РЕКОМЕНДАЦИЙ
// ===============================

const recommendButton =
    document.getElementById("recommendButton");


recommendButton.addEventListener(
    "click",
    async function () {

        const movie1 =
            document.getElementById("movie1");

        const movie2 =
            document.getElementById("movie2");

        const movie3 =
            document.getElementById("movie3");


        const movieId1 =
            movie1.dataset.movieId;

        const movieId2 =
            movie2.dataset.movieId;

        const movieId3 =
            movie3.dataset.movieId;


        // ===============================
        // ПРОВЕРКА
        // ===============================

        if (!movieId1 || !movieId2 || !movieId3) {

            alert(
                "Выбери фильм из результатов поиска для всех трёх полей."
            );

            return;
        }

        recommendButton.disabled = true;
        recommendButton.textContent =
            "⏳ Получаем рекомендации...";

        const movieIds = [
            Number(movieId1),
            Number(movieId2),
            Number(movieId3)
        ];


        console.log(
            "Отправляем фильмы:",
            movieIds
        );


        try {

            // ===============================
            // ОТПРАВЛЯЕМ НА BACKEND
            // ===============================

            const response = await fetch(
                "https://moviematch-8yak.onrender.com/recommend",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        movie_ids: movieIds
                    })
                }
            );


            if (!response.ok) {

                throw new Error(
                    `Ошибка сервера: ${response.status}`
                );
            }


            const data =
                await response.json();


            console.log(
                "Ответ backend:",
                data
            );


            // ===============================
            // РЕЗУЛЬТАТЫ
            // ===============================

            const results =
                document.getElementById("results");


            results.innerHTML = `
                <h2>🎬 Рекомендации для тебя</h2>

                <div class="movies-grid"></div>
            `;


            const moviesGrid =
                results.querySelector(
                    ".movies-grid"
                );


            // Если рекомендаций нет
            if (
                !data.recommendations ||
                data.recommendations.length === 0
            ) {

                moviesGrid.innerHTML = `
                    <p>
                        Не удалось найти рекомендации.
                    </p>
                `;

                return;
            }


            // ===============================
            // СОЗДАЁМ КАРТОЧКИ ФИЛЬМОВ
            // ===============================

            data.recommendations.forEach(
                function (movie) {

                    const poster =
                        movie.poster_path
                            ? `http://127.0.0.1:8000/poster?path=${encodeURIComponent(movie.poster_path)}`
                            : "";


                    const movieElement =
                        document.createElement("div");


                    movieElement.className =
                        "movie-card";
                    movieElement.addEventListener(
                        "click",
                function () {
                            openMovieModal(movie);
                        }
                    );


                    movieElement.innerHTML = `
                        
                        ${
                            poster
                                ? `
                                    <img
                                        src="${poster}"
                                        alt="${movie.title || "Фильм"}"
                                    >
                                `
                                : `
                                    <div class="no-poster">
                                        🎬
                                    </div>
                                `
                        }

                        <div class="movie-info">

                            <h3>
                                ${
                                    movie.title
                                        || "Без названия"
                                }
                            </h3>

                            <div class="movie-rating">
                                ⭐ ${
                                    movie.vote_average !== null &&
                                    movie.vote_average !== undefined
                                        ? movie.vote_average.toFixed(1)
                                        : "—"
                                }
                            </div>

                            <div class="movie-year">
                                📅 ${
                                    movie.release_date
                                        ? movie.release_date.substring(0, 4)
                                        : "—"
                                }
                            </div>

                        </div>
                    `;


                    moviesGrid.appendChild(
                        movieElement
                    );
                }
            );

                } catch (error) {

            console.error(
                "Ошибка рекомендаций:",
                error
            );

            alert(
                "Не удалось получить рекомендации."
            );

        } finally {

            recommendButton.disabled = false;

            recommendButton.textContent =
                "Получить рекомендации";
        }
    }
);
// ===============================
// ОКНО С ОПИСАНИЕМ ФИЛЬМА
// ===============================

const movieModal =
    document.getElementById("movieModal");

const movieModalBody =
    document.getElementById("movieModalBody");

const closeMovieModal =
    document.getElementById("closeMovieModal");


// ===============================
// ОТКРЫТИЕ ФИЛЬМА
// ===============================

function openMovieModal(movie) {

    const poster =
        movie.poster_path
            ? `http://127.0.0.1:8000/poster?path=${encodeURIComponent(movie.poster_path)}`
            : "";

    movieModalBody.innerHTML = `

        <div class="movie-modal-body">

            ${
                poster
                    ? `
                        <img
                            src="${poster}"
                            class="movie-modal-poster"
                            alt="${movie.title || "Фильм"}"
                        >
                    `
                    : ""
            }

            <div class="movie-modal-info">

                <h2>
                    ${movie.title || "Без названия"}
                </h2>

                <div class="movie-modal-rating">
                    ⭐ ${
                        movie.vote_average !== null &&
                        movie.vote_average !== undefined
                            ? movie.vote_average.toFixed(1)
                            : "—"
                    }
                </div>

                <div class="movie-modal-year">
                    📅 ${
                        movie.release_date
                            ? movie.release_date.substring(0, 4)
                            : "Год неизвестен"
                    }
                </div>

                <div class="movie-modal-overview">

                    ${
                        movie.overview
                            || "Описание фильма отсутствует."
                    }

                </div>

            </div>

        </div>
    `;

    movieModal.classList.add("active");
}


// ===============================
// ЗАКРЫТИЕ
// ===============================

function closeMovieModalWindow() {

    movieModal.classList.remove("active");

}


// Крестик

closeMovieModal.addEventListener(
    "click",
    closeMovieModalWindow
);


// Клик по затемнённому фону

movieModal.addEventListener(
    "click",
    function (event) {

        if (event.target === movieModal) {

            closeMovieModalWindow();

        }

    }
);


// ESC

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape" &&
            movieModal.classList.contains("active")
        ) {

            closeMovieModalWindow();

        }

    }
);

// ===============================
// ПОКАЗЫВАЕМ ВЫБРАННЫЙ ФИЛЬМ
// ===============================

function showSelectedMovie(input, movie) {

    const container = input.parentElement;

    // Убираем старую карточку, если она была
    const oldCard =
        container.querySelector(".selected-movie-card");

    if (oldCard) {
        oldCard.remove();
    }

    // Прячем поле поиска,
    // но НЕ удаляем его
    input.style.display = "none";

    const poster = movie.poster_path
        ? `http://127.0.0.1:8000/poster?path=${encodeURIComponent(movie.poster_path)}`
        : "";

    const selectedCard =
        document.createElement("div");

    selectedCard.className =
        "selected-movie-card";

    selectedCard.innerHTML = `

        ${
            poster
                ? `
                    <img
                        src="${poster}"
                        class="selected-movie-poster"
                        alt="${movie.title || "Фильм"}"
                    >
                `
                : `
                    <div class="selected-movie-no-poster">
                        🎬
                    </div>
                `
        }

        <div class="selected-movie-info">

            <h3>
                ${movie.title || "Без названия"}
            </h3>

            <span>
                ${
                    movie.release_date
                        ? movie.release_date.substring(0, 4)
                        : "Год неизвестен"
                }
            </span>

        </div>

        <button
            type="button"
            class="change-movie-button"
        >
            ×
        </button>
    `;

    container.appendChild(selectedCard);


    // Кнопка смены фильма
    const changeButton =
        selectedCard.querySelector(
            ".change-movie-button"
        );

    changeButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            event.stopPropagation();

            resetSelectedMovie(
                input,
                selectedCard
            );
        }
    );
}


// ===============================
// СМЕНА ВЫБРАННОГО ФИЛЬМА
// ===============================

function resetSelectedMovie(
    input,
    selectedCard
) {

    selectedCard.remove();

    // Возвращаем поиск
    input.style.display = "block";

    // Очищаем выбранный фильм
    delete input.dataset.movieId;
    delete input.dataset.movieTitle;
    delete input.dataset.movieYear;
    delete input.dataset.moviePoster;

    input.value = "";

    input.focus();

    updateRecommendButton();
}