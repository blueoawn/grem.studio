import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { ErrorNotification } from "../components/ErrorNotification";
import { setGlobalErrorHandler } from "./SpacetimeContext";

interface ErrorContextType {
  showError: (message: string) => void;
}

const ErrorContext = createContext<ErrorContextType>({
  showError: () => {},
});

export function useError() {
  return useContext(ErrorContext);
}

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState("");

  const showError = useCallback((message: string) => {
    console.error("Error:", message);
    setError(message);
  }, []);

  useEffect(() => {
    setGlobalErrorHandler(showError);
  }, [showError]);

  return (
    <ErrorContext.Provider value={{ showError }}>
      {error && (
        <ErrorNotification
          message={error}
          onClose={() => setError("")}
        />
      )}
      {children}
    </ErrorContext.Provider>
  );
}
