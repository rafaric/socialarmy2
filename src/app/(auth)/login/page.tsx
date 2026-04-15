"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/Card";

function LoginPage() {
  const router = useRouter();

  return (
    <Card type="login">
      <h1 className="text-center text-purple-600 pt-6 md:text-7xl leading-10 text-3xl font-monotone">
        Bienvenidos a SocialArmy
      </h1>
      <h2 className="text-center text-2xl">
        La red social exclusiva para el BTS Army
      </h2>
      <button
        type="button"
        className="rounded-md bg-purple-500 text-white py-6 px-4 hover:text-black hover:shadow-[10px_10px_23px_-7px_rgba(82,0,64,0.75)] hover:bg-purple-200 hover:scale-110 hover:transition-all duration-500"
        onClick={() => router.push("/")}
      >
        Entrar
      </button>
    </Card>
  );
}

export default LoginPage;
