import { cookies } from "next/headers";
import { Button, Container, Stack, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { EquipmentGrid } from "@/components/installs/EquipmentGrid";
import { PasswordGate } from "@/components/installs/PasswordGate";
import { INSTALLS_SESSION_COOKIE, verifyInstallsSessionToken } from "@/lib/auth";

export default async function InstallsPage() {
  const cookieStore = await cookies();
  const isAuthenticated = verifyInstallsSessionToken(
    cookieStore.get(INSTALLS_SESSION_COOKIE)?.value
  );

  return (
    <Container maxWidth={false} sx={{ py: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
      {isAuthenticated ? (
        <>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, mb: 1 }}
          >
            <Typography variant="h4" component="h1" gutterBottom>
              Install Base
            </Typography>
            <Button variant="outlined" startIcon={<DownloadIcon />} href="/api/export" download>
              Export
            </Button>
          </Stack>
          <EquipmentGrid />
        </>
      ) : (
        <PasswordGate />
      )}
    </Container>
  );
}
