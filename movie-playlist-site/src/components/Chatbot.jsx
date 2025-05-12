import React, { useState, useEffect } from "react";
import axios from "axios";
import { playlistsService, moviesService, customUserMovieService } from "../services/databaseSupabase";

const ANIMATION_DURATION = 350; // ms

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { role: "system", content: `
      You are Bingie, a friendly movie assistant for a movie playlist website.
      - You can recommend movies by genre, year, or rating.
      - You can help users build playlists and suggest what to watch next.
      - If a user asks about a movie, provide a short summary and why it might be interesting.
      - Do not hallucinate. If you don't know the answer, say so.
      - Keep your responses concise and to the point.
      - Use a fun, conversational tone.
      ` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [userContext, setUserContext] = useState(null);

  useEffect(() => {
    if (open) {
      setIsOpening(true);
      const timer = setTimeout(() => setIsOpening(false), ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Fetch user info, playlists, watched movies, most watched genre, and recommended movies on mount
  useEffect(() => {
    async function fetchUserContext() {
      try {
        console.log("Fetching user context...");
        const user = await moviesService.getUser();
        console.log("User fetched:", user);
        
        const playlists = await playlistsService.getUserPlaylists(user.id);
        console.log("Playlists fetched:", playlists.length);
        
        const watched = await moviesService.getUserWatchedMovies(user.id);
        console.log("Watched movies fetched:", watched.length);
        
        const mostWatchedGenre = await customUserMovieService.getUserMostWatchedGenre(user.id);
        console.log("Most watched genre ID:", mostWatchedGenre);
        
        const mostWatchedActor = await customUserMovieService.getUserMostWatchedActor(user.id);
        console.log("Most watched actor ID:", mostWatchedActor);

        const mostWatchedGenreName = mostWatchedGenre
            ? await customUserMovieService.getGenre(mostWatchedGenre)
            : null;
        console.log("Most watched genre name:", mostWatchedGenreName);
        
        const mostWatchedActorName = mostWatchedActor
            ? await customUserMovieService.getActor(mostWatchedActor)
            : null;
        console.log("Most watched actor name:", mostWatchedActorName);
            
        let recommended = [];
        if (mostWatchedGenre || mostWatchedActor) {
          recommended = await customUserMovieService.getRecommendedMoviesForUser(user.id, mostWatchedGenre, mostWatchedActor, 5);
          console.log("Recommendations fetched:", recommended.length);
        }
        
        setUserContext({ 
          user, 
          playlists, 
          watched, 
          mostWatchedGenre: mostWatchedGenreName, 
          mostWatchedActor: mostWatchedActorName, 
          recommended 
        });
        console.log("User context set successfully");
      } catch (err) {
        console.error("Error fetching user context:", err);
        setUserContext(null);
      }
    }
    fetchUserContext();
  }, []);

  // Build context string for the system prompt
  const buildContextPrompt = (ctx) => {
    if (!ctx) return "";
    const { user, playlists, watched, mostWatchedGenre, mostWatchedActor, recommended } = ctx;
    const playlistNames = playlists?.map(p => p.name).join(", ") || "none";
    const watchedTitles = watched?.map(w => w.movie?.title).filter(Boolean).join(", ") || "none";
    const recommendedTitles = recommended?.map(m => m.title).join(", ") || "none";
    const age = user?.date_of_birth ? Math.floor((new Date() - new Date(user.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) : "N/A";
    console.log("Building context prompt with user data");
    return `
    User info: ${user?.username || "Unknown"}, age: ${age}\n
    Playlists: ${playlistNames}\n
    Watched movies: ${watchedTitles}\n
    Most watched genre: ${mostWatchedGenre || "Not enough data"}\n
    Most watched actor: ${mostWatchedActor || "Not enough data"}\n
    Recommended movies (based on your favorite genre and actor): ${recommendedTitles}`;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    // Insert user context as a system message after the main system prompt
    let contextMsg = null;
    if (userContext) {
      contextMsg = {
        role: "system",
        content: buildContextPrompt(userContext)
      };
    }
    const baseSystemMsg = messages[0];
    const rest = messages.slice(1).filter(m => m.role !== "system"); // Filter out previous system messages
    const newMessages = [
      baseSystemMsg,
      ...(contextMsg ? [contextMsg] : []),
      ...rest,
      { role: "user", content: input }
    ];
    if (contextMsg) {
      console.log("Injected user context for bot:", contextMsg.content);
    } else {
      console.log("No user context available");
    }
    setMessages([...messages, { role: "user", content: input }]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5003/api/chat", {
        messages: newMessages
      });
      const botMessage = res.data.choices[0].message;
      setMessages([...messages, { role: "user", content: input }, botMessage]);
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setOpen(false);
    }, ANIMATION_DURATION);
  };

  // Floating Bingie logo button when closed
  if (!open) {
    return (
      <button
        className="chatbot-logo"
        style={{
          position: "fixed",
          bottom: 32,
          right: 32,
          zIndex: 1001,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          boxShadow: "0 2px 12px rgba(13,2,33,0.15)",
        }}
        onClick={() => setOpen(true)}
        aria-label="Open Bingie chatbot"
      >
        <img src="/bingie final.png" alt="Open Bingie chatbot" className="chatbot-logo" style={{height: 64, width: 64}} />
      </button>
    );
  }

  return (
    <div
      className={`chatbot-window${isClosing ? " closing" : ""}${isOpening ? " opening" : ""}`}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1000,
        width: 340,
        height: 420,
        minWidth: 280,
        minHeight: 320,
        maxWidth: 480,
        maxHeight: 600,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div className="chatbot-header" style={{position: "relative"}}>
        <img src="/bingie final.png" className="chatbot-logo" alt="Bingie" />
        <div className="chatbot-title">Bingie</div>
        <button
          onClick={handleClose}
          aria-label="Close chatbot"
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "#A6CFD5",
            fontSize: 28,
            fontWeight: 700,
            cursor: "pointer",
            lineHeight: 1,
            padding: 0,
            zIndex: 2
          }}
        >
          ×
        </button>
      </div>
      <div className="chatbot-body" style={{flex: 1, overflowY: "auto"}}>
        {messages
          .filter(m => m.role !== "system")
          .map((m, i) => (
            <div
            key={i}
            className={
                "chatbot-message-row " +
                (m.role === "user" ? "user" : "bot")
            }
            >
            <div
                className={
                "chatbot-message " +
                (m.role === "user" ? "user" : "bot")
                }
            >
                {m.content}
            </div>
            </div>
          ))}
        {loading && <div className="chatbot-message bot">Bot is typing...</div>}
      </div>
      <div className="chatbot-input-row">
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && sendMessage()}
        placeholder="Ask me about movies..."
          disabled={loading}
      />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
        Send
      </button>
      </div>
    </div>
  );
};

export default Chatbot;