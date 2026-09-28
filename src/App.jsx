import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CharacterPage from "./pages/CharacterPage";
import CharacterModePage from "./pages/CharacterModePage";
import CharactersListPage from "./pages/CharactersListPage";
import NewCharacterPage from "./pages/NewCharacterPage";
import DmDashboardPage from "./pages/DmDashboardPage";
import MapLibraryPage from "./pages/MapLibraryPage";
import MapViewerPage from "./pages/MapViewerPage";
import DmSettingsPage from "./pages/DmSettingsPage";
import ChroniclePage from "./pages/ChroniclePage";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Routes>
        <Route path="/"                          element={<CharactersListPage />} />
        <Route path="/dm"                        element={<DmDashboardPage />} />
        <Route path="/dm/settings"               element={<DmSettingsPage />} />
        <Route path="/chronicle"                 element={<ChroniclePage />} />
        <Route path="/chronicle/record"          element={<ChroniclePage />} />
        <Route path="/chronicle/:sessionId"      element={<ChroniclePage />} />
        <Route path="/maps"                      element={<MapLibraryPage />} />
        <Route path="/map-view"                  element={<MapViewerPage />} />
        <Route path="/characters/new"            element={<NewCharacterPage />} />
        <Route path="/characters/:slug"          element={<CharacterPage />} />
        <Route path="/characters/:slug/profile"  element={<CharacterModePage />} />
        <Route path="/characters/:slug/session"  element={<CharacterModePage />} />
        <Route path="*"                          element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
