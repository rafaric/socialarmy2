import { useState, useContext } from "react";
import { Button, Input } from "@supabase/ui";

import { UserContext } from "../contexts/UserContext";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import Card from "../components/Card.js";

function LoginPage() {
  const session = useSupabaseClient();
  const { setUser } = useContext(UserContext);

  const handleGoogleSignIn = async () => {
    const { user, error } = await session.auth.signInWithOAuth({
      provider: "google",
    });
    if (error) console.log("Error signing in with Google:", error.message);
    else {
      setUser(user);
    }
    console.log(user);
  };

  return (
    <Card type="login">
      <h1 className="text-center text-purple-600 pt-6 md:text-7xl leading-10 text-3xl font-monotone">
        Bienvenidos a SocialArmy
      </h1>
      <h2 className="text-center text-2xl">
        La red social exclusiva para el BTS Army
      </h2>
      <button
        className="rounded-md bg-purple-500 text-white py-6 px-4 hover:text-black hover:shadow-[10px_10px_23px_-7px_rgba(82,0,64,0.75)] hover:bg-purple-200 hover:scale-110 hover:transition-all duration-500"
        onClick={handleGoogleSignIn}
      >
        Iniciar sesión con Google
      </button>
    </Card>
  );
}

export default LoginPage;
