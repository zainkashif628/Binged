import requests
import time
import os
import random
import logging
from dotenv import load_dotenv
from datetime import datetime, timezone
from supabase import create_client, Client
from tempfile import NamedTemporaryFile
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv() # load env variables from .env file

#logger
log_format = "[%(asctime)s] [%(levelname)s] %(message)s"
logging.basicConfig(
    level=logging.WARNING,
    format=log_format,
    handlers=[
        logging.FileHandler("movie_import.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)

#tmdb and supabase credentials
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_API_KEY = os.getenv("SUPABASE_API_KEY")
POSTER_BUCKET = "movie-posters"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_API_KEY)
TMDB_BASE_URL = "https://api.themoviedb.org/3"

inserted_members = set()
genders = {
    0: "unknown",
    1: 'female',
    2: 'male',
}

def fetch_movie_details(movie_id):
    time.sleep(random.randrange(10, 1000) / 1000)  # random sleep to avoid hitting API rate limits
    url = f"{TMDB_BASE_URL}/movie/{movie_id}?api_key={TMDB_API_KEY}&append_to_response=videos"
    res = requests.get(url)
    return res.json() if res.status_code == 200 else None

def upload_poster(movie_id, poster_path):
    if not poster_path:
        return None
    poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
    filename = f"{movie_id}.jpg"

    while True:
        try:
            res = requests.get(poster_url)
            if res.status_code != 200:
                logging.error(f"⚠️ Failed to fetch poster {movie_id}, retrying in 0.1s...")
                time.sleep(0.1)
                continue

            with NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
                tmp_file.write(res.content)
                tmp_file_path = tmp_file.name

            supabase.storage.from_(POSTER_BUCKET).upload(filename, tmp_file_path, {
                "content-type": "image/jpeg",
                "x-upsert": "true"
            })
            os.remove(tmp_file_path)
            return filename
        except Exception as e:
            logging.error(f"❌ Upload error for poster {movie_id}: {e}, retrying in 0.1s...")
            time.sleep(0.1)

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

def upload_profile(member_id, profile_path):
    if not profile_path:
        return None
    profile_url = f"https://image.tmdb.org/t/p/w500{profile_path}"
    filename = f"{member_id}.jpg"

    while True:
        try:
            res = requests.get(profile_url)
            if res.status_code != 200:
                logging.error(f"⚠️ Failed to fetch profile {member_id}, retrying...")
                time.sleep(0.1)
                continue

            with NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
                tmp_file.write(res.content)
                tmp_file_path = tmp_file.name

            supabase.storage.from_("crew-imgs").upload(filename, tmp_file_path, {
                "content-type": "image/jpeg",
                "x-upsert": "true"
            })
            os.remove(tmp_file_path)
            return filename
        except Exception as e:
            logging.error(f"❌ Upload error for profile {member_id}: {e}, retrying...")
            time.sleep(0.1)

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
                logging.error(f"❌ Couldn't fetch details for {movie_id}")
                return

            credits = fetch_credits(movie_id)
            if not credits:
                logging.error(f"❌ Couldn't fetch credits for {movie_id}")
                return
            # print(f"credits gotten")
            poster_filename = upload_poster(movie["id"], movie["poster_path"])
            # print(f"poster_filename: {poster_filename}")
            trailer_key = None
            retry_count = 0
            max_retries = 3
            while trailer_key is None and retry_count < max_retries:
                for video in movie.get("videos", {}).get("results", []):
                    if video["site"] == "YouTube" and video["type"] == "Trailer":
                        trailer_key = video["key"]
                        break
                if trailer_key is None:
                    logging.error(f"⚠️ No trailer key for {movie_id}, retrying fetch ({retry_count+1})...")
                    time.sleep(0.1)
                    movie = fetch_movie_details(movie_id)
                    retry_count += 1

            # print(f"trailer_key: {trailer_key}")

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
                "poster_path": poster_filename,
                "rating": rating
            }
            supabase.table("movie").upsert(movie_data).execute()
            # print("after supabase insert")
            # insert genres
            for genre in movie.get("genres", []):
                supabase.table("movie_genre").upsert({
                    "movie_id": movie["id"],
                    "genre_id": genre["id"]
                }).execute()
            # print("after genre insert")
            # insert cast members
            for cast_member in credits.get("cast", [])[:20]:  # limit top 20 actors
                actor_id = cast_member["id"]
                if actor_id not in inserted_members:
                    person = fetch_person(actor_id)
                    if person:
                        profile_filename = upload_profile(actor_id, person.get("profile_path"))
                        crew_data = {
                            "member_id": person["id"],
                            "name": person.get("name"),
                            "biography": person.get("biography"),
                            "death_date": person.get("deathday"),
                            "birthday": person.get("birthday"),
                            "place_of_birth": person.get("place_of_birth"),
                            "profile_url": profile_filename,
                            "popularity": person.get("popularity"),
                            "known_for": person.get("known_for_department"),
                            "gender": genders.get(person.get("gender", 0), "unknown")
                        }
                        supabase.table("crew_member").upsert(crew_data).execute()
                        inserted_members.add(actor_id)
                # insert into movie-actor
                supabase.table("movie_actor").upsert({
                    "movie_id": movie["id"],
                    "actor_id": actor_id
                }).execute()
            # print("after cast insert")

            # insert director
            for crew_member in credits.get("crew", []):
                if crew_member.get("job") == "Director":
                    director_id = crew_member["id"]
                    if director_id not in inserted_members:
                        person = fetch_person(director_id)
                        if person:
                            profile_filename = upload_profile(director_id, person.get("profile_path"))
                            crew_data = {
                                "member_id": person["id"],
                                "name": person.get("name"),
                                "biography": person.get("biography"),
                                "death_date": person.get("deathday"),
                                "birthday": person.get("birthday"),
                                "place_of_birth": person.get("place_of_birth"),
                                "profile_url": profile_filename,
                                "popularity": person.get("popularity"),
                                "known_for": person.get("known_for_department"),
                                "gender": genders.get(person.get("gender", 0), "unknown")
                            }
                            supabase.table("crew_member").upsert(crew_data).execute()
                            inserted_members.add(director_id)

                    # insert into movie-actor
                    supabase.table("movie_actor").upsert({
                        "movie_id": movie["id"],
                        "actor_id": director_id
                    }).execute()
                    break
            # print("after director insert")
            break  # finished successfully
        except Exception as e:
            logging.error(f"⚠️ Network error for movie {movie_id}, retrying in 0.1s... ({str(e)})")
            time.sleep(0.1)


def main():
    with open("progress.txt") as f:
        page = int(f.read())
    max_pages = page + 30
    max_workers = 5  # number of threads to use for concurrent requests
    start_time = time.time()
    while page <= max_pages:
        elapsed_time = time.time() - start_time
        try:
            res = requests.get(f"{TMDB_BASE_URL}/movie/popular?api_key={TMDB_API_KEY}&page={page}")
            if res.status_code != 200:
                logging.error(f"❌ Failed to fetch page {page}")
                break
            results = res.json().get("results", [])

            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [executor.submit(insert_movie_with_retry, movie["id"]) for movie in results]
                for future in as_completed(futures):
                    future.result()

            page += 1
            with open("progress.txt", "w") as f:
                f.write(str(page))
            logging.warning(f"page: {page} in progress")
        except Exception as e:
            logging.warning(f"⚠️ Error fetching page {page}, retrying in 0.1s... ({e})")
            time.sleep(0.1)

if __name__ == "__main__":
    main()