import traceback
import requests
import time
import os
import logging
import pickle
from dotenv import load_dotenv
from datetime import datetime, timezone
from supabase import create_client, Client
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv() # load env variables from .env file

#logger
for handler in logging.root.handlers[:]:
    logging.root.removeHandler(handler)

log_format = "[%(asctime)s] [%(levelname)s] %(message)s"
logging.basicConfig(
    level=logging.WARNING,
    format=log_format,
    handlers=[
        logging.FileHandler("movie_import.log", encoding="utf-8"),
    ]
)

#tmdb and supabase credentials
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_API_KEY = os.getenv("SUPABASE_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_API_KEY)
TMDB_BASE_URL = "https://api.themoviedb.org/3"

genders = {
    0: "unknown",
    1: 'female',
    2: 'male',
}

movie_batch = []
crew_members_batch = []
movie_genres_batch_set = set()
movie_actors_batch_set = set()

res = supabase.table("language").select("lang_id").execute()
existing_languages = set(row["lang_id"] for row in res.data)

res = supabase.table("crew_member").select("member_id").execute()
inserted_members = set(row["member_id"] for row in res.data)

def fetch_movie_details(movie_id):
    time.sleep(0.01)  # random sleep to avoid hitting API rate limits
    url = f"{TMDB_BASE_URL}/movie/{movie_id}?api_key={TMDB_API_KEY}&append_to_response=videos"
    res = requests.get(url)
    return res.json() if res.status_code == 200 else None

def get_movie_certification(movie_id):
    url = f"https://api.themoviedb.org/3/movie/{movie_id}/release_dates"
    params = {"api_key": TMDB_API_KEY}
    res = requests.get(url, params=params).json()

    for country in res.get("results", []):
        if country["iso_3166_1"] == "US":
            for release in country["release_dates"]:
                cert = release.get("certification")
                if cert:
                    return cert
    return "NR"

def fetch_credits(movie_id):
    url = f"{TMDB_BASE_URL}/movie/{movie_id}/credits?api_key={TMDB_API_KEY}"
    res = requests.get(url)
    return res.json() if res.status_code == 200 else None

def fetch_person(person_id):
    url = f"{TMDB_BASE_URL}/person/{person_id}?api_key={TMDB_API_KEY}"
    res = requests.get(url)
    return res.json() if res.status_code == 200 else None

def insert_movie_with_retry(movie_id):
    while True:
        try:
            movie = fetch_movie_details(movie_id)
            # print(f"movie: {movie["id"]}")
            if not movie:
                logging.error(f"Couldn't fetch details for {movie_id}")
                return

            credits = fetch_credits(movie_id)
            if not credits:
                logging.error(f"Couldn't fetch credits for {movie_id}")
                return
            # print(f"credits gotten")

            trailer_key = None
            retry_count = 0
            max_retries = 2
            while trailer_key is None and retry_count < max_retries:
                for video in movie.get("videos", {}).get("results", []):
                    if video["site"] == "YouTube" and video["type"] == "Trailer":
                        trailer_key = video["key"]
                        break
                if trailer_key is None:
                    time.sleep(0.1)
                    movie = fetch_movie_details(movie_id)
                    retry_count += 1

            rating = get_movie_certification(movie_id)

            # insert movie
            movie_data = {
                "movie_id": movie["id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "title": movie.get("title"),
                "synopsis": movie.get("overview"),
                "tagline": movie.get("tagline"),
                "budget": movie.get("budget"),
                "release_date": movie.get("release_date"),
                "runtime": movie.get("runtime"),
                "status": movie.get("status"),
                "revenue": movie.get("revenue"),
                "popularity": movie.get("popularity"),
                "lang_id": movie.get("original_language"),
                "trailer_key": trailer_key,
                "poster_path": movie.get("poster_path"),
                "rating": rating
            }
            if movie_data["release_date"] == "":
                movie_data["release_date"] = None
            if movie_data["lang_id"] == "cn":
                movie_data["lang_id"] = "zh"
            if movie_data["lang_id"] == "sh":
                movie_data["lang_id"] = "sr"
            if movie_data["lang_id"] not in existing_languages:
                movie_data["lang_id"] = "en"            
            movie_batch.append(movie_data)

            # print("after supabase insert")
            # insert genres
            for genre in movie.get("genres", []):
                movie_genres_batch_set.add((movie["id"], genre["id"]))

            # print("after genre insert")
            # insert cast members
            for cast_member in credits.get("cast", [])[:50]:  # limit top 20 actors
                actor_id = cast_member["id"]
                if actor_id not in inserted_members:
                    person = fetch_person(actor_id)
                    if person:
                        crew_data = {
                            "member_id": person["id"],
                            "name": person.get("name"),
                            "biography": person.get("biography"),
                            "death_date": person.get("deathday"),
                            "birthday": person.get("birthday"),
                            "place_of_birth": person.get("place_of_birth"),
                            "profile_url": person.get("profile_path"),
                            "popularity": person.get("popularity"),
                            "known_for": person.get("known_for_department"),
                            "gender": genders.get(person.get("gender", 0), "unknown")
                        }
                        crew_members_batch.append(crew_data)
                        movie_actors_batch_set.add((movie["id"], actor_id))
                else:
                    # insert into movie-actor
                    movie_actors_batch_set.add((movie["id"], actor_id))

            # print("after cast insert")
            # insert director
            for crew_member in credits.get("crew", []):
                if crew_member.get("job") == "Director":
                    director_id = crew_member["id"]
                    if director_id not in inserted_members:
                        person = fetch_person(director_id)
                        if person:
                            crew_data = {
                                "member_id": person["id"],
                                "name": person.get("name"),
                                "biography": person.get("biography"),
                                "death_date": person.get("deathday"),
                                "birthday": person.get("birthday"),
                                "place_of_birth": person.get("place_of_birth"),
                                "profile_url": person.get("profile_path"),
                                "popularity": person.get("popularity"),
                                "known_for": person.get("known_for_department"),
                                "gender": genders.get(person.get("gender", 0), "unknown")
                            }
                            crew_members_batch.append(crew_data)
                            movie_actors_batch_set.add((movie["id"], director_id))

                    else:
                        # insert into movie-actor
                        movie_actors_batch_set.add((movie["id"], director_id))

                    break
            # print("after director insert")
            break  # finished successfully
        except Exception as e:
            logging.error(f"Network error movie {movie_id}, retrying... ({str(e)})")
            time.sleep(0.1)

def flush_batches():
    global movie_batch, movie_genres_batch_set, crew_members_batch, movie_actors_batch_set
    try:
        # movie table: unique on movie_id
        if movie_batch:
            unique_movies = {m["movie_id"]: m for m in movie_batch}.values()
            supabase.table("movie").upsert(list(unique_movies)).execute()

        # movie_genre table: unique on (movie_id, genre_id)
        if movie_genres_batch_set:
            unique_movie_genres = list({(m, g) for m, g in movie_genres_batch_set})
            supabase.table("movie_genre").upsert(
                [{"movie_id": m, "genre_id": g} for m, g in unique_movie_genres]
            ).execute()

        # crew_member table: unique on member_id
        if crew_members_batch:
            unique_crew = {c["member_id"]: c for c in crew_members_batch}.values()
            supabase.table("crew_member").upsert(list(unique_crew)).execute()
            for crew in unique_crew:
                inserted_members.add(crew["member_id"])  # update after confirmed insert

        # movie_actor table: unique on (movie_id, actor_id)
        existing_member_ids = inserted_members
        unique_movie_actors = [
            {"movie_id": m, "actor_id": a}
            for m, a in movie_actors_batch_set
            if a in existing_member_ids
        ]
        if unique_movie_actors:
            supabase.table("movie_actor").upsert(unique_movie_actors).execute()

    except Exception as e:
        logging.error(f"Error flushing batches: {str(e)}")
    finally:
        movie_batch.clear()
        movie_genres_batch_set.clear()
        crew_members_batch.clear()
        movie_actors_batch_set.clear()


def main():
    global inserted_members, movie_genres_batch_set, movie_actors_batch_set
    with open("progress.pkl", "rb") as f:
        data = pickle.load(f)
        year = data["year"]
        page = data["page"]
        movie_genres_batch_set = data["movie_genres_batch_set"]
        movie_actors_batch_set = data["movie_actors_batch_set"]


    print(f"Starting from year {year}, page {page}")
    min_year = 1990
    max_workers = 5

    while year >= min_year:
        if page > 100:
            year -= 1
            page = 1
            continue
        try:
            res = requests.get(
                f"{TMDB_BASE_URL}/discover/movie",
                params={
                    "api_key": TMDB_API_KEY,
                    "primary_release_year": year,
                    "sort_by": "popularity.desc",
                    "page": page,
                    "include_adult": False
                }
            )
            if res.status_code != 200:
                logging.error(f"Failed to fetch year {year}, page {page}")
                continue

            results = res.json().get("results", [])
            if not results:
                year -= 1
                page = 1
                continue

            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [executor.submit(insert_movie_with_retry, movie["id"]) for movie in results]
                for future in as_completed(futures):
                    future.result()

            flush_batches()
            page += 1

            with open("progress.pkl", "wb") as f:
                pickle.dump({
                    "year": year,
                    "page": page,
                    "inserted_members": inserted_members,
                    "movie_genres_batch_set": movie_genres_batch_set,
                    "movie_actors_batch_set": movie_actors_batch_set
                }, f)
            logging.warning(f"Year {year}, Page {page} in progress")

        except Exception as e:
            logging.warning(f"Error fetching year {year}, page {page}, retrying... ({e})\n{traceback.format_exc()}")
            time.sleep(0.1)


if __name__ == "__main__":
    main()