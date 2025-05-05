import pickle

with open("progress.pkl", "rb") as f:
    data = pickle.load(f)
    inserted_members = data["inserted_members"]
    movie_genres_batch_set = data["movie_genres_batch_set"]
    movie_actors_batch_set = data["movie_actors_batch_set"]
    
initial_data = {
    "year": 1995,
    "page": 1,
    "inserted_members": inserted_members,
    "movie_genres_batch_set": set(),
    "movie_actors_batch_set": set()
}

with open("progress.pkl", "wb") as f:
    pickle.dump(initial_data, f)