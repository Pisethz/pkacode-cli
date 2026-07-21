import ora from 'ora';

// Re-export Ora type for spinner instances
export type SpinnerInstance = ReturnType<typeof ora>;

let currentSpinner: SpinnerInstance | null = null;

export function startSpinner(text: string): SpinnerInstance {
  if (currentSpinner) {
    currentSpinner.stop();
  }
  currentSpinner = ora({
    text,
    spinner: 'dots',
    color: 'cyan',
  }).start();
  return currentSpinner;
}

export function stopSpinner(spinner?: SpinnerInstance): void {
  if (spinner) {
    spinner.stop();
    if (currentSpinner === spinner) currentSpinner = null;
  } else if (currentSpinner) {
    currentSpinner.stop();
    currentSpinner = null;
  }
}

export function succeedSpinner(spinner: SpinnerInstance, text?: string): void {
  spinner.succeed(text);
  if (currentSpinner === spinner) currentSpinner = null;
}

export function failSpinner(spinner: SpinnerInstance, text?: string): void {
  spinner.fail(text);
  if (currentSpinner === spinner) currentSpinner = null;
}
