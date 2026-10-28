// Small drawings of real controls, for the combat quick-start steps.
export const Token = ({ name, pc, ring, reticle }) => (
  <div className={`cg-token${pc ? " pc" : ""}`}>
    {name}
    {ring && <span className="cg-ring" />}
    {reticle && <span className="cg-reticle" />}
  </div>
);
export const Chip = ({ children, cls = "" }) => <span className={`cg-chip ${cls}`}>{children}</span>;
