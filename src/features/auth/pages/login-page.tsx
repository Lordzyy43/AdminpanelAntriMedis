import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, Stethoscope } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { supabase } from "../../../lib/supabase";

const schema = z.object({
  email: z.string().email("Email belum valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginForm) {
    setIsLoading(true);
    setError(null);
    const { error: signInError } =
      await supabase.auth.signInWithPassword(values);
    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  return (
    <main className="grid min-h-screen bg-slate-50 px-6 py-10 lg:grid-cols-[1fr_460px] lg:gap-10">
      <section className="flex items-center">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:pl-10">
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-900/15">
            <Stethoscope size={28} />
          </div>
          <p className="mb-3 text-sm font-black uppercase tracking-wide text-teal-700">
            AntriMedis Admin
          </p>
          <h1 className="max-w-xl text-4xl font-black leading-tight text-slate-950 lg:text-5xl">
            Dashboard operasional antrean klinik.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
            Pantau sesi antrean hari ini, panggil pasien berikutnya, dan ubah
            status pelayanan dari satu panel kerja.
          </p>
        </div>
      </section>

      <section className="flex items-center">
        <Card className="w-full p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-black">Masuk Admin</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gunakan akun admin klinik untuk mengelola layanan hari ini.
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">
                Email
              </span>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-3 text-slate-400"
                  size={18}
                />
                <Input className="pl-10" {...form.register("email")} />
              </div>
              {form.formState.errors.email ? (
                <span className="mt-1 block text-sm text-rose-600">
                  {form.formState.errors.email.message}
                </span>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">
                Password
              </span>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-3 text-slate-400"
                  size={18}
                />
                <Input
                  className="pl-10"
                  type="password"
                  {...form.register("password")}
                />
              </div>
              {form.formState.errors.password ? (
                <span className="mt-1 block text-sm text-rose-600">
                  {form.formState.errors.password.message}
                </span>
              ) : null}
            </label>

            <Button className="w-full" disabled={isLoading} type="submit">
              {isLoading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </Card>
      </section>
    </main>
  );
}
