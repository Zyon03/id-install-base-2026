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
      <Toolbar sx={{ gap: 1 }}>
        <Typography
          variant="h6"
          component="div"
          noWrap
          sx={{ flexGrow: 1, minWidth: 0, fontSize: { xs: "1rem", sm: "1.25rem" } }}
        >
          ID Install Base 2026
        </Typography>
        <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }}>
          {LINKS.map((link) => (
            <Button
              key={link.href}
              component={Link}
              href={link.href}
              color="inherit"
              variant={pathname === link.href ? "outlined" : "text"}
              sx={{ px: { xs: 1, sm: 2 }, whiteSpace: "nowrap" }}
            >
              {link.label}
            </Button>
          ))}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
