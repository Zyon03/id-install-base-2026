"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppBar, Button, Stack, Toolbar, Typography } from "@mui/material";

const LINKS = [
  { href: "/installs", label: "Install Base" },
  { href: "/new", label: "New Entry" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <AppBar position="static" color="primary">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          ID Install Base 2026
        </Typography>
        <Stack direction="row" spacing={1}>
          {LINKS.map((link) => (
            <Button
              key={link.href}
              component={Link}
              href={link.href}
              color="inherit"
              variant={pathname === link.href ? "outlined" : "text"}
            >
              {link.label}
            </Button>
          ))}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
