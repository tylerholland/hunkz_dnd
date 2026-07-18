import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { getSessionState } from "../api";
import { PALETTES } from "../components/CharacterSheet";
import { useAdaptivePolling } from "../lib/liveSync";
import { reportServerBuildVersion } from "../lib/staleClient";
import MapViewer from "../features/maps/MapViewer";
import { displayMapName } from "../features/dmDashboard/MapUploadModal";

export default function MapViewerPage() {
  const [searchParams] = useSearchParams();
  const themeKey = searchParams.get("theme") || "ocean";
  const pal = PALETTES[themeKey] || PALETTES.ocean;
  const [mapLibrary, setMapLibrary] = useState({ activeMapId: null, activeMapView: null, maps: [] });

  // Story 35b — poll the consolidated session-state endpoint (public
  // variant, no password) instead of the standalone map-library endpoint.
  const fetchSessionState = useCallback(async () => {
    try {
      const data = await getSessionState();
      setMapLibrary(data?.mapLibrary || { activeMapId: null, activeMapView: null, maps: [] });
      reportServerBuildVersion(data?.buildVersion);
    } catch {
      // Keep stale data instead of flashing an error.
    }
  }, []);

  useEffect(() => {
    fetchSessionState();
  }, [fetchSessionState]);

  useAdaptivePolling({
    enabled: true,
    poll: fetchSessionState,
  });

  const activeMap = mapLibrary.maps?.find((m) => m.id === mapLibrary.activeMapId) || null;
  const activeMapView = activeMap && mapLibrary.activeMapView?.mapId === activeMap.id ? mapLibrary.activeMapView : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), ${pal.bg}`,
      color: pal.text,
      padding: "24px 24px 30px",
    }}>
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <Link
            to="/"
            style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted, textDecoration: "none" }}
          >
            ← Close Map Window
          </Link>
          {activeMap && (
            <div style={{ fontFamily: pal.fontUI, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.textMuted, textAlign: "right" }}>
              {displayMapName(activeMap)}
            </div>
          )}
        </div>

        {activeMap ? (
          <MapViewer
            imageUrl={activeMap.imageUrl}
            name={activeMap.name}
            contentType={activeMap.contentType}
            height={"calc(100vh - 96px)"}
            pal={pal}
            publishedView={activeMapView}
            allowResetToPublished={!!activeMapView}
            resetLabel="Current View"
          />
        ) : (
          <div style={{ minHeight: "calc(100vh - 120px)", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${pal.border}`, borderRadius: 6, background: pal.surface }}>
            <div style={{ fontFamily: pal.fontBody, fontSize: 16, color: pal.textMuted, fontStyle: "italic" }}>
              The DM hasn&apos;t loaded a map yet.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
