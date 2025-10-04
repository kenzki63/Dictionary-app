// src/App.jsx
import React, { useEffect, useState, useRef } from "react";
import "./App.css";

export default function App() {
  const [dictionary, setDictionary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const historyRef = useRef([]); // mirror to avoid stale closures
  const historyIndex = useRef(-1);
  const inputRef = useRef(null);

  // Load dictionary.json at startup (eager)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/dictionary.json");
        if (!res.ok) throw new Error("Failed to fetch dictionary.json: " + res.status);
        const json = await res.json();
        if (!mounted) return;
        setDictionary(json);
      } catch (err) {
        console.error(err);
        setError("Failed to load dictionary.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // keyboard support: Enter = search, Esc = clear, Up/Down = history
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter") {
        // if input focused
        if (document.activeElement === inputRef.current) {
          e.preventDefault();
          doSearch();
        }
      } else if (e.key === "Escape") {
        setWord("");
        setResult(null);
      } else if (e.key === "ArrowUp") {
        if (historyRef.current.length === 0) return;
        e.preventDefault();
        if (historyIndex.current < historyRef.current.length - 1) {
          historyIndex.current += 1;
        }
        const idx = historyRef.current.length - 1 - historyIndex.current;
        const val = historyRef.current[idx] ?? "";
        setWord(val);
      } else if (e.key === "ArrowDown") {
        if (historyRef.current.length === 0) return;
        e.preventDefault();
        if (historyIndex.current > 0) {
          historyIndex.current -= 1;
          const idx = historyRef.current.length - 1 - historyIndex.current;
          setWord(historyRef.current[idx] ?? "");
        } else {
          historyIndex.current = -1;
          setWord("");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const doSearch = (w) => {
    const term = (w ?? word ?? "").trim().toLowerCase();
    if (!term) {
      setError("Please enter a word.");
      setResult(null);
      return;
    }
    setError("");
    if (!dictionary) {
      setError("Dictionary not loaded yet.");
      return;
    }

    const entry = dictionary[term] || null;
    if (!entry) {
      setResult(null);
      setError("No match.");
      // still push to history
      pushHistory(term);
      return;
    }
    setResult(entry);
    pushHistory(term);
  };

  function pushHistory(term) {
    if (!term) return;
    // avoid duplicates consecutively
    const h = historyRef.current;
    if (h.length === 0 || h[h.length - 1] !== term) {
      h.push(term);
      if (h.length > 100) h.shift();
      historyRef.current = h;
      setHistory([...h]);
    }
    historyIndex.current = -1;
  }

  function onClickSynonym(syn) {
    setWord(syn);
    doSearch(syn);
    // focus input
    inputRef.current?.focus();
  }

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-box">
          <div className="splash-title">Loading dictionary…</div>
          <div className="spinner" aria-hidden></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="topbar">
        <h1 className="title">Offline Dictionary</h1>
        <div className="search-row">
          <input
            ref={inputRef}
            className="search-input"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Enter a word and press Enter"
            aria-label="Search word"
          />
          <button className="btn" onClick={() => doSearch()}>Search</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="content">
        {result ? (
          <div className="entry">
            <h2 className="entry-word">{result.word || "(unknown)"} </h2>

            {Object.entries(result).map(([pos, defs]) => {
              if (pos === "word") return null; // skip meta if present
              // defs is an array of { definition, synonyms? }
              return (
                <div className="pos-block" key={pos}>
                  <h3 className="pos-title">{pos.toUpperCase()}</h3>
                  {defs.map((d, i) => (
                    <div className="definition-block" key={i}>
                      <p className="definition">• {d.definition}</p>
                      {d.synonyms && d.synonyms.length > 0 && (
                        <div className="synonyms">
                          {d.synonyms.map((s, si) => (
                            <button key={si} className="syn-tag" onClick={() => onClickSynonym(s)}>{s}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="placeholder">
            <p>Type a word and press Enter to search. Click synonyms to jump to them.</p>
          </div>
        )}
      </div>

      <footer className="footer">
        <div>WordNet-based offline dictionary · Dark theme</div>
      </footer>
    </div>
  );
}
