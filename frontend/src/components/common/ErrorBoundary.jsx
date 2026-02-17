import { Component } from 'react';
import { useNavigate } from 'react-router-dom';

class ErrorBoundaryInner extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-icon" aria-hidden="true">!</div>
          <h2>{this.props.title || 'Something went wrong'}</h2>
          <p>{this.props.message || "We couldn't load this page. Please try again."}</p>
          <div className="error-boundary-actions">
            <button
              className="btn"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </button>
            {this.props.onGoHome && (
              <button className="btn btn-primary" onClick={this.props.onGoHome}>
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ErrorBoundary({ children, title, message }) {
  const navigate = useNavigate();
  return (
    <ErrorBoundaryInner
      title={title}
      message={message}
      onGoHome={() => navigate('/')}
    >
      {children}
    </ErrorBoundaryInner>
  );
}
