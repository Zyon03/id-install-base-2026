import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#0f4c81" },
  },
  typography: {
    fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
  },
  shape: {
    borderRadius: 8,
  },
});
