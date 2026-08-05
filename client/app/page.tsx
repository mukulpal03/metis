"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Terminal, Loader2, LogOut, User, Mail, ShieldCheck } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-mono">Checking session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
        },
      },
    });
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg space-y-6">
        <Card className="border-border/60 bg-card/80 shadow-2xl backdrop-blur-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Terminal className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Metis Dashboard
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Authenticated session details
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* User details section */}
            <div className="rounded-xl border border-border/50 bg-accent/30 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User Avatar"}
                    className="h-12 w-12 rounded-full border border-border"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <User className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-foreground text-base">
                    {session.user.name || "Authenticated User"}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 font-mono">
                    <Mail className="h-3.5 w-3.5" />
                    {session.user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Status info */}
            <div className="rounded-xl border border-border/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-500 font-medium text-sm">
                <ShieldCheck className="h-4 w-4" />
                Active Session Verified
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate">
                User ID: {session.user.id}
              </p>
            </div>

            {/* Action buttons */}
            <Button
              variant="destructive"
              className="w-full h-11 font-medium transition-all"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
