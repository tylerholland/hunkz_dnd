import { Component } from "react";
import { useLocation } from "react-router-dom";
import "./ErrorBoundary.css";

class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Render crash:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__title">Something broke on this page</div>
        <div className="error-boundary__message">{String(error?.message || error)}</div>
        <div className="error-boundary__actions">
          <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>Reload</button>
          <button type="button" className="btn-ghost" onClick={() => window.history.back()}>Go back</button>
        </div>
      </div>
    );
  }
}

export default function ErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}
