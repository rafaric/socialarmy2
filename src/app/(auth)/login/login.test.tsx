import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(auth)/login/page";

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el formulario de login por defecto", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar al Army" })).toBeInTheDocument();
  });

  it("el toggle muestra los dos modos: iniciar sesión y registrarse", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrarse" })).toBeInTheDocument();
  });

  it("cambia a modo registro al clickear el botón Registrarse", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Registrarse" }));

    expect(screen.getByPlaceholderText("Tu nombre")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();
  });

  it("llama a signInWithPassword con las credenciales correctas", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Email"), "test@test.com");
    await user.type(screen.getByPlaceholderText("Contraseña"), "password123");
    await user.click(screen.getByRole("button", { name: "Entrar al Army" }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
      });
    });
  });

  it("muestra error cuando supabase devuelve un error de login", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Invalid credentials" } });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("Email"), "wrong@test.com");
    await user.type(screen.getByPlaceholderText("Contraseña"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Entrar al Army" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("llama a signUp con nombre, email y contraseña en modo registro", async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Registrarse" }));
    await user.type(screen.getByPlaceholderText("Tu nombre"), "Rafael");
    await user.type(screen.getByPlaceholderText("Email"), "rafa@test.com");
    await user.type(screen.getByPlaceholderText("Contraseña"), "pass1234");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "rafa@test.com",
        password: "pass1234",
        options: { data: { name: "Rafael" } },
      });
    });
  });

  it("muestra mensaje de éxito tras el registro", async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Registrarse" }));
    await user.type(screen.getByPlaceholderText("Tu nombre"), "Rafael");
    await user.type(screen.getByPlaceholderText("Email"), "rafa@test.com");
    await user.type(screen.getByPlaceholderText("Contraseña"), "pass1234");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(screen.getByText(/Revisá tu email/)).toBeInTheDocument();
    });
  });
});
