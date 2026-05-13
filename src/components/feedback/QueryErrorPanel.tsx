import { getErrorMessage } from '@/lib/misskey/errors';

type QueryErrorPanelProps = {
  title: string;
  error: unknown;
  fallbackMessage: string;
  onRetry?: () => void;
};

export function QueryErrorPanel(props: QueryErrorPanelProps) {
  const { title, error, fallbackMessage, onRetry } = props;
  const message = getErrorMessage(error, fallbackMessage);

  return (
    <section className="panel">
      <h1>{title}</h1>
      <p className="form-error">{message}</p>
      {onRetry ? (
        <button className="retry-button" type="button" onClick={onRetry}>
          再試行
        </button>
      ) : null}
    </section>
  );
}
