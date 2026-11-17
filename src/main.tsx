import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// StrictMode désactivé : il double l'initialisation de la scène PixiJS
createRoot(document.getElementById("root")!).render(<App />);
