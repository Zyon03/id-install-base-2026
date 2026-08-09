import { Container, Typography } from "@mui/material";

export default function NewEntryPage() {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        New Entry
      </Typography>
      <Typography color="text.secondary">
        The install entry form lands in a later task.
      </Typography>
    </Container>
  );
}
