import { createTheme, ThemeProvider } from '@mui/material/styles';

const defaultTheme = createTheme({
 palette: {
    primary: {
      main: '#ffffff'
    },
    text: {
      primary: '#ffffff',
      secondary: '#ffffff', // Assuming you want secondary text to be white
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#383851',
          color: "#ffffff", // This will set text color for text elements inside Card
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          color: '#ffffff', // This will set text color for Button
          backgroundColor: '#383851', // This will set background color for Button
        },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          color: '#ffffff', // This will set color for SvgIcon
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#383851',
          height: '40px',
          alignItems: 'center',
          justifyContent: 'center',
          border: '0px',
          color: '#FF0000', // This will set text color for AppBar
        },
      },
    },
  }, 
});

export default defaultTheme;