import { ThemeProvider } from '@mui/material/styles';
import React, { useState } from 'react';
import projects from './ProjectsObj';
import defaultTheme from './DefaultTheme';
import ContactForm from './ContactForm';
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Toolbar,
  Collapse,
  AppBar,
  Grid,
  Typography,
  Box,
  Container,
  CssBaseline,
  Link,
  CardActionArea,
} from '@mui/material';
import './App.css';

const Section = ({ id, children }) => (
  <Box
    id={id}
    sx={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'center',
    }}
  >
    {children}
  </Box>
);

const scrollToSection = (sectionId) => {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const ProjectCard = ({ project }) => {
  const [expanded, setExpanded] = useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  return (
    <ThemeProvider theme={defaultTheme}>
      <Card sx={{ position: 'relative', '&:hover .project-title': { opacity: 0.9 } }}>
        <Box
          sx={{
            position: 'relative',
            height: 140,
            '&:hover img': { opacity: 0.8 },
          }}
          onMouseEnter={handleExpandClick}
          onMouseLeave={handleExpandClick}
        >
          <CardActionArea href={project.link} target="_blank">
            <CardMedia
              component="img"
              image={project.imageUrl}
              alt={project.title}
              sx={{
                height: 'auto',
              }}
            />
          </CardActionArea>
        </Box>
        <CardActions disableSpacing>
          <Collapse in={expanded} timeout="auto">
            <CardContent>
              <Typography
                className="project-title"
                variant="h7"
                component="div"
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: 'white',
                  opacity: 0,
                  transition: 'opacity 0.2s ease-in-out',
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  padding: '8px',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                }}
              >
                {project.title}
              </Typography>
            </CardContent>
            <Typography
              paragraph
              className="project-description"
              component="div"
              sx={{
                position: 'absolute',
                width: '100%',
                top: '93%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '0.8rem',
                color: 'white',
                opacity: 1,
                transition: 'opacity 0.2s ease-in-out',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: '4px',
                margin: '0px',
                pointerEvents: 'none',
              }}
            >
              {project.description}
            </Typography>
          </Collapse>
        </CardActions>
      </Card>
    </ThemeProvider>
  );
};

function Copyright() {
  return (
    <Typography variant="body" color="text.secondary">
      {'Copyright © '}
      <Link color="#1C1C21" href="https://kayo-b.github.io/">
        kayo-b.github.io
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={defaultTheme}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: (theme) =>
            theme.palette.mode === 'light' ? '#1C1C21' : theme.palette.grey[700],
        }}
      >
        <AppBar position="sticky" sx={{ mb: 8 }}>
          <Toolbar>
            <Button color="inherit" onClick={() => scrollToSection('section1')}>
              projects
            </Button>
            <Button color="inherit" onClick={() => scrollToSection('section2')}>
              about
            </Button>
            <Button color="inherit" onClick={() => scrollToSection('section3')}>
              contact
            </Button>
          </Toolbar>
        </AppBar>
        <CssBaseline />
        <Section id="section1">
          <Container component="main" sx={{ mt: 12, mb: 2 }} maxWidth="sm">
            <Typography variant="h5" component="h2" alignItens="center" sx={{ mb: 3 }} gutterBottom>
              projects.
            </Typography>
            <Grid container spacing={4}>
              {projects.map((project) => (
                <Grid item xs={12} sm={12} md={12} xl={12} key={project.id}>
                  <ProjectCard project={project} />
                </Grid>
              ))}
            </Grid>
          </Container>
        </Section>
        <Section id="section2">
          <Container component="main" sx={{ mt: 8, mb: 2 }} maxWidth="sm">
            <Typography variant="h5" component="h2" sx={{ mb: 3 }} gutterBottom>
              about.
            </Typography>
            <Typography paragraph>
              Aspiring Fullstack developer, currently pursuing a bachelor's degree in software engineering and dabbling
              in game development during spare time.
            </Typography>
          </Container>
        </Section>
        <Section id="section3">
          <Container component="main" sx={{ mt: 8, mb: 2 }} maxWidth="sm">
            <Typography variant="h5" component="h2" sx={{ mb: 3 }} gutterBottom>
              contact.
            </Typography>
            <ContactForm />
            {/* Add your contact content here */}
          </Container>
        </Section>
        <Box
          component="footer"
          sx={{
            py: 2,
            px: 2,
            mt: 'auto',
            backgroundColor: (theme) =>
              theme.palette.mode === 'light' ? theme.palette.grey[500] : theme.palette.grey[800],
          }}
        >
          <Container maxWidth="sm">
            <Typography variant="body1">{/* My sticky footer can be found here. */}</Typography>4
            <Copyright />
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
