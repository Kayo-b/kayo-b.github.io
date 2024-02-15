
import React, { useRef } from 'react';
import emailjs from 'emailjs-com';
import { TextField, Button, Box } from '@mui/material';

const ContactForm = () => {
    const form = useRef();
  
    const sendEmail = (e) => {
      e.preventDefault();
  
      emailjs.sendForm('service_40efg74', 'template_7d3vrrs', form.current, 'pC6lsNGP7IGANeD6x')
        .then((result) => {
            console.log(result.text);
            alert("Message sent successfully!");
        }, (error) => {
            console.log(error.text);
            alert("Failed to send the message, please try again.");
        });
    };
  
    return (
      <Box
        component="form"
        ref={form}
        onSubmit={sendEmail}
        noValidate
        sx={{ mt: 1 }}
      >
        <TextField
          margin="normal"
          required
          fullWidth
          id="name"
          label="Name"
          name="user_name"
          autoComplete="name"
          sx={{backgroundColor: '#383851'}}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label="Email Address"
          name="user_email"
          autoComplete="email"
          sx={{backgroundColor: '#383851'}}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          name="message"
          label="Message"
          type="text"
          id="message"
          multiline
          rows={4}
          sx={{backgroundColor: '#383851'}}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
        >
          Send
        </Button>
      </Box>
    );
  };
  
  export default ContactForm;