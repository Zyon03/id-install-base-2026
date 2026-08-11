import { Button, Container, Stack, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { EquipmentGrid } from "@/components/installs/EquipmentGrid";

export default function InstallsPage() {
  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Install Base
        </Typography>
        <Button variant="outlined" startIcon={<DownloadIcon />} href="/api/export" download>
          Export
        </Button>
      </Stack>
      <EquipmentGrid />
    </Container>
  );
}
