import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CharacterPage from "./pages/CharacterPage";
import CharactersListPage from "./pages/CharactersListPage";
import NewCharacterPage from "./pages/NewCharacterPage";
import DmDashboardPage from "./pages/DmDashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                   element={<CharactersListPage />} />
        <Route path="/dm"                 element={<DmDashboardPage />} />
        <Route path="/characters/new"     element={<NewCharacterPage />} />
        <Route path="/characters/:slug"   element={<CharacterPage />} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
