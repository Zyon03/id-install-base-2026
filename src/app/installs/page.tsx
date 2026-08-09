import { Container, Typography } from "@mui/material";

export default function InstallsPage() {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Install Base
      </Typography>
      <Typography color="text.secondary">
        The searchable, editable grid lands in a later task.
      </Typography>
    </Container>
  );
}
