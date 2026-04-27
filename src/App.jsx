import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CharacterPage from "./pages/CharacterPage";
import CharacterSheet from "./components/CharacterSheet";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Named character routes — /characters/aragorn, /characters/eoghan, etc. */}
        <Route path="/characters/:slug" element={<CharacterPage />} />

        {/* Blank template — useful for starting a new character from scratch */}
        <Route path="/characters/new" element={<CharacterSheet />} />

        {/* Redirect root to a default character, or change to /characters/new */}
        <Route path="/" element={<Navigate to="/characters/aragorn" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
