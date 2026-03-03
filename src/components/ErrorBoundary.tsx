import React from 'react';

/**
 * Error Boundary 错误边界组件
 * 捕获子组件树中的 JavaScript 错误，记录错误并显示降级 UI
 */

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * 错误边界组件
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * 捕获子组件抛出的错误
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  /**
   * 捕获错误信息并记录
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    
    // 记录错误到控制台
    console.error('[ErrorBoundary] 捕获到错误:', error);
    console.error('[ErrorBoundary] 错误堆栈:', errorInfo.componentStack);
    
    // 这里可以添加错误上报逻辑
    // 例如：发送到 Sentry、LogRocket 等监控服务
  }

  /**
   * 重置错误状态
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * 刷新页面
   */
  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义降级 UI，则使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认的错误 UI
      return (
        <div style={styles.container}>
          <div style={styles.content}>
            <div style={styles.icon}>⚠️</div>
            <h2 style={styles.title}>出现了一些问题</h2>
            <p style={styles.message}>
              很抱歉，应用程序遇到了一个错误。请尝试刷新页面或联系支持团队。
            </p>
            
            {this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>查看错误详情</summary>
                <pre style={styles.errorText}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div style={styles.actions}>
              <button onClick={this.handleReset} style={styles.button}>
                重试
              </button>
              <button onClick={this.handleReload} style={styles.button}>
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 样式定义
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#f5f5f7',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  content: {
    maxWidth: '500px',
    width: '100%',
    padding: '40px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    textAlign: 'center',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: '#1c1c1e',
  },
  message: {
    margin: '0 0 24px 0',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#3c3c43',
  },
  details: {
    marginBottom: '24px',
    textAlign: 'left',
    backgroundColor: '#f2f2f7',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '12px',
  },
  summary: {
    cursor: 'pointer',
    fontWeight: '500',
    color: '#007AFF',
    marginBottom: '8px',
  },
  errorText: {
    margin: '8px 0 0 0',
    padding: '12px',
    backgroundColor: '#fff',
    borderRadius: '6px',
    fontSize: '11px',
    overflow: 'auto',
    maxHeight: '200px',
    color: '#ff3b30',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  button: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#ffffff',
    backgroundColor: '#007AFF',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};

/**
 * 高阶组件：为组件添加错误边界
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: React.ReactNode
): React.FC<P> {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
