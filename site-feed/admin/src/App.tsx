import { SpacetimeProvider } from "./context/SpacetimeContext";
import { ErrorProvider } from "./context/ErrorContext";
import { NavbarLoader } from "./components/NavbarLoader";
import { LoginGate } from "./components/LoginGate";
import { PostsAdminPage } from "./pages/PostsAdminPage";
import "./App.css";

export function App() {
  return (
    <ErrorProvider>
      <SpacetimeProvider>
        <NavbarLoader />
        <LoginGate>
          <div className="forum-container">
            <PostsAdminPage />
          </div>
        </LoginGate>
      </SpacetimeProvider>
    </ErrorProvider>
  );
}
