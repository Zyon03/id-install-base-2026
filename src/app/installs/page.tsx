import { Container, Typography } from "@mui/material";
import { EquipmentGrid } from "@/components/installs/EquipmentGrid";

export default function InstallsPage() {
  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Install Base
      </Typography>
      <EquipmentGrid />
    </Container>
  );
}
