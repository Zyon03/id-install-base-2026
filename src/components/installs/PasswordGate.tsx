"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";

export function PasswordGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const res = await fetch("/api/auth/installs-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Something went wrong. Please try again.");
      return;
    }

    setPassword("");
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", pt: { xs: 6, sm: 10 } }}>
      <Paper elevation={2} sx={{ p: 4, width: "100%", maxWidth: 360 }}>
        <Stack component="form" onSubmit={handleSubmit} spacing={2}>
          <Typography variant="h6" component="h1">
            Install Base is locked
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter the password to continue.
          </Typography>
          <TextField
            type="password"
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            required
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            type="submit"
            variant="contained"
            disabled={isPending || password.length === 0}
          >
            {isPending ? "Checking…" : "Unlock"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
