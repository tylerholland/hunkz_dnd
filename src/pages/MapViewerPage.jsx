import { useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { getSessionState } from "../api";
import { PALETTES } from "../components/CharacterSheet";
import { useAdaptivePolling } from "../lib/liveSync";
import { reportServerBuildVersion } from "../lib/staleClient";
import MapViewer from "../features/maps/MapViewer";
import { displayMapName } from "../features/dmDashboard/MapUploadModal";
import TopNav from "../components/TopNav";

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

  const palVars = {
    "--pal-bg":            pal.bg,
    "--pal-surface":       pal.surface,
    "--pal-surface-solid": pal.surfaceSolid,
    "--pal-border":        pal.border,
    "--pal-accent":        pal.accent,
    "--pal-accent-bright": pal.accentBright,
    "--pal-accent-dim":    pal.accentDim,
    "--pal-text":          pal.text,
    "--pal-text-body":     pal.textBody,
    "--pal-text-muted":    pal.textMuted,
    "--pal-glow-1":        pal.glow1,
    "--pal-glow-2":        pal.glow2,
  };

  return (
    <div style={{
      ...palVars,
      minHeight: "100vh",
      background: `radial-gradient(ellipse at 50% 0%, ${pal.glow1} 0%, transparent 60%), ${pal.bg}`,
      color: pal.text,
    }}>
      <TopNav
        backTo="/"
        title={activeMap ? displayMapName(activeMap) : "Map Viewer"}
      />
      <div style={{ padding: "16px 24px 30px" }}>
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
