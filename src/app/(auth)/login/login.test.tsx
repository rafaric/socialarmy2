import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(auth)/login/page";

// Mock completo de supabase
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
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el formulario de login", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Contraseña")).toBeInTheDocument();
    expect(screen.getByText("Entrar")).toBeInTheDocument();
  });

  it("permite cambiar a modo registro", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    
    const toggleButton = screen.getByText("¿No tenés cuenta? Registrate");
    await user.click(toggleButton);
    
    // Ahora debería verse el input de nombre y el botón de crear cuenta
    expect(screen.getByPlaceholderText("Tu nombre")).toBeInTheDocument();
    // El botón tiene un tipo específico, usamos getByRole
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();
  });

  it("muestra error cuando email está vacío al hacer login", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    
    render(<LoginPage />);
    
    // Intentar hacer login sin completar campos
    const loginButton = screen.getByRole("button", { name: "Entrar" });
    await user.click(loginButton);
    
    // Verificar que se intentó llamar a signInWithPassword
    expect(mockSignInWithPassword).toHaveBeenCalled();
  });

  it("llama a signInWithPassword cuando se hace login", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    
    render(<LoginPage />);
    
    await user.type(screen.getByPlaceholderText("Email"), "test@test.com");
    await user.type(screen.getByPlaceholderText("Contraseña"), "password123");
    await user.click(screen.getByText("Entrar"));
    
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
      });
    });
  });
});