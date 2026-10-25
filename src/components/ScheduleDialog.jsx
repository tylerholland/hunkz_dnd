import { useState } from "react";
import "./scheduleDialog.css";

const pad = (n) => String(n).padStart(2, "0");
const dateValue = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Pick the date (and time) of the next session. onSave(iso | null). */
export default function ScheduleDialog({ current, saving, error, light = false, onSave, onClose }) {
  const [date, setDate] = useState(current ? dateValue(current) : "");
  const [time, setTime] = useState(current ? timeValue(current) : "19:00");

  function submit(e) {
    e.preventDefault();
    if (!date) return;
    const at = new Date(`${date}T${time || "19:00"}`);
    if (Number.isNaN(at.getTime())) return;
    onSave(at.toISOString());
  }

  return (
    <div className="sched" data-light={light ? "true" : undefined} role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="sched-box" role="dialog" aria-modal="true" aria-labelledby="sched-h" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <h3 id="sched-h">Schedule the next session</h3>
        <label>
          Date
          <input type="date" value={date} required autoFocus onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        {error && <div className="sched-error" role="alert">{error}</div>}
        <div className="sched-actions">
          {current && <button type="button" className="sched-link" disabled={saving} onClick={() => onSave(null)}>Clear</button>}
          <button type="button" className="sched-link" onClick={onClose}>Cancel</button>
          <button type="submit" className="sched-save" disabled={saving || !date}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}
