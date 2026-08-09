import { Container, Typography } from "@mui/material";
import { EquipmentForm } from "@/components/new/EquipmentForm";

export default function NewEntryPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        New Entry
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Add a new equipment install for an existing or brand-new customer. Fields marked with
        an asterisk are required.
      </Typography>
      <EquipmentForm />
    </Container>
  );
}
