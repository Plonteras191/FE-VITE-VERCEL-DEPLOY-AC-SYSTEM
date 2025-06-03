import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { parseISO, format } from 'date-fns';
import ReCAPTCHA from "react-google-recaptcha";
import "react-datepicker/dist/react-datepicker.css";
import styles from '../styles/Booking.module.css';
import apiClient from '../services/api';

const serviceOptions = {
  cleaning: "Cleaning",
  repair: "Repair",
  installation: "Installation",
  maintenance: "Checkup and Maintenance",
};

const acTypeOptions = [
  "Windows",
  "Split"
];

const Booking = () => {
  const [selectedServices, setSelectedServices] = useState([]);
  const [serviceDates, setServiceDates] = useState({});
  const [serviceAcTypes, setServiceAcTypes] = useState({});
  const [globalAvailableDates, setGlobalAvailableDates] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [recaptchaValue, setRecaptchaValue] = useState(null);
  const recaptchaRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.get('/getAvailableDates', {
      params: { 
        global: 1, 
        start: '2025-01-01', 
        end: '2025-12-31'
      }
    })
      .then(response => {
        const dates = response.data.map(dateStr => parseISO(dateStr));
        setGlobalAvailableDates(dates);
      })
      .catch(err => console.error("Error fetching available dates:", err));
  }, []);

  const handleServiceChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setSelectedServices(prev => [...prev, value]);
      setServiceDates(prev => ({ ...prev, [value]: null }));
      setServiceAcTypes(prev => ({ ...prev, [value]: [] }));
    } else {
      setSelectedServices(prev => prev.filter(service => service !== value));
      setServiceDates(prev => {
        const newDates = { ...prev };
        delete newDates[value];
        return newDates;
      });
      setServiceAcTypes(prev => {
        const newAcTypes = { ...prev };
        delete newAcTypes[value];
        return newAcTypes;
      });
    }
  };

  const handleACTypeChange = (service, acType) => {
    setServiceAcTypes(prev => {
      const currentTypes = prev[service] || [];
      if (currentTypes.includes(acType)) {
        return {
          ...prev,
          [service]: currentTypes.filter(type => type !== acType)
        };
      } else {
        return {
          ...prev,
          [service]: [...currentTypes, acType]
        };
      }
    });
  };

  const handleServiceDateChange = (service, date) => {
    setServiceDates(prev => ({ ...prev, [service]: date }));
  };

  const isDateGloballyAvailable = (date) => {
    if (globalAvailableDates.length === 0) return true;
    return globalAvailableDates.some(avDate =>
      avDate.toDateString() === date.toDateString()
    );
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(''); // Clear previous form-level errors

    if (!recaptchaValue) {
      setFormError('Please verify that you are not a robot');
      return;
    }

    let newErrors = { services: {} };
    let hasErrors = false;

    for (const service of selectedServices) {
      const serviceErrors = {};

      if (!serviceDates[service]) {
        serviceErrors.date = `Please select a date for ${serviceOptions[service]}.`;
        hasErrors = true;
      } else if (!isDateGloballyAvailable(serviceDates[service])) {
        serviceErrors.date = `The selected date for ${serviceOptions[service]} is no longer available. Please select another date.`;
        hasErrors = true;
      }

      if (!serviceAcTypes[service] || serviceAcTypes[service].length === 0) {
        serviceErrors.acTypes = `Please select at least one AC type for ${serviceOptions[service]}.`;
        hasErrors = true;
      }

      if (Object.keys(serviceErrors).length > 0) {
        newErrors.services[service] = serviceErrors;
      }
    }

    setErrors(newErrors);

    if (hasErrors) {
      return;
    }    const formData = new FormData(e.target);
    const bookingData = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      completeAddress: formData.get('completeAddress'),
      recaptchaToken: recaptchaValue,
      services: selectedServices.map(service => ({
        type: serviceOptions[service],
        date: serviceDates[service] ? format(serviceDates[service], 'yyyy-MM-dd') : null,
        acTypes: serviceAcTypes[service] || []
      }))
    };

    apiClient.post('/booking', bookingData)      .then(response => {
        console.log("Response from backend:", response.data);
        if (response.data.bookingId) {
          // Reset reCAPTCHA
          recaptchaRef.current.reset();
          setRecaptchaValue(null);
          navigate('/confirmation', { state: bookingData });
        } else {
          setFormError("Error saving booking: " + response.data.message);
        }
      })
      .catch(error => {
        console.error("Error saving booking:", error);
        setFormError("Error saving booking. Please try again later.");
      });
  };
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Book Your Appointment</h2>
      <div className={styles.bookingCard}>
        <div className={styles.headerSection}>
          <div className={styles.headerContent}>
            <div className={styles.iconContainer}>
              <svg xmlns="http://www.w3.org/2000/svg" className={styles.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className={styles.headerTitle}>Schedule your service</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.formContainer}>
          {formError && (
            <div className={styles.errorAlert}>
              <span>{formError}</span>
            </div>
          )}
          <div className={styles.formContent}>
            <div>
              <h3 className={styles.sectionTitle}>
                <span className={styles.numberBadge}>1</span>
                Service Selection
              </h3>
              <p className={styles.sectionDescription}>Select one or more services that you need</p>
              
              <div className={styles.servicesGrid}>
                {Object.entries(serviceOptions).map(([key, label]) => (
                  <label 
                    key={key} 
                    className={`${styles.serviceCard} ${
                      selectedServices.includes(key) ? styles.serviceCardSelected : ''
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      value={key} 
                      checked={selectedServices.includes(key)} 
                      onChange={handleServiceChange}
                      className={styles.checkbox}
                    />
                    <div className={styles.serviceLabel}>{label}</div>
                  </label>
                ))}
              </div>
              
              {selectedServices.length > 0 && (
                <div className={styles.serviceDetails}>
                  {selectedServices.map(service => (
                    <div key={service} className={styles.serviceDetailCard}>
                      <h4 className={styles.serviceDetailTitle}>{serviceOptions[service]} Service Details</h4>
                      
                      <div className={styles.formGroup}>
                        <label className={styles.label}>
                          Date for {serviceOptions[service]}
                          <span className={styles.required}>*</span>
                        </label>
                        <DatePicker
                          selected={serviceDates[service]}
                          onChange={(date) => handleServiceDateChange(service, date)}
                          minDate={new Date()}
                          filterDate={isDateGloballyAvailable}
                          placeholderText="Select available date"
                          required
                          dateFormat="yyyy-MM-dd"
                          className={styles.input}
                        />
                        {errors.services?.[service]?.date && (
                          <p className={styles.errorText}>{errors.services[service].date}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className={styles.label}>
                          AC Types for {serviceOptions[service]}
                          <span className={styles.required}>*</span>
                        </label>
                        <div className={styles.acTypesContainer}>
                          {acTypeOptions.map(acType => (
                            <label 
                              key={`${service}-${acType}`}
                              className={`${styles.acTypeCard} ${
                                serviceAcTypes[service]?.includes(acType) ? styles.acTypeSelected : ''
                              }`}
                            >
                              <input 
                                type="checkbox" 
                                checked={serviceAcTypes[service]?.includes(acType) || false}
                                onChange={() => handleACTypeChange(service, acType)}
                                className={styles.checkbox}
                              />
                              <span className={styles.serviceLabel}>{acType}</span>
                            </label>
                          ))}
                        </div>
                        {errors.services?.[service]?.acTypes && (
                          <p className={styles.errorText}>{errors.services[service].acTypes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedServices.length > 0 && (
              <div>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.numberBadge}>2</span>
                  Personal Information
                </h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="name" className={styles.label}>
                      Full Name<span className={styles.required}>*</span>
                    </label>
                    <input 
                      type="text" 
                      id="name" 
                      name="name" 
                      placeholder="Enter your name" 
                      required 
                      pattern="[A-Za-z ]+" 
                      title="Name should contain only letters and spaces."
                      className={styles.input}
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="phone" className={styles.label}>
                      Phone Number<span className={styles.required}>*</span>
                    </label>
                    <input 
                      type="tel" 
                      id="phone" 
                      name="phone" 
                      placeholder="Enter 11-digit phone number" 
                      required 
                      pattern="^[0-9]{11}$" 
                      title="Phone number must be exactly 11 digits."
                      className={styles.input}
                    />
                  </div>
                  
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label htmlFor="email" className={styles.label}>
                      Email Address
                    </label>
                    <input 
                      type="email" 
                      id="email" 
                      name="email" 
                      placeholder="Enter your email (optional)"
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedServices.length > 0 && (
              <div>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.numberBadge}>3</span>
                  Service Location
                </h3>
                <div>
                  <label htmlFor="completeAddress" className={styles.label}>
                    Complete Address<span className={styles.required}>*</span>
                  </label>
                  <textarea 
                    id="completeAddress"
                    name="completeAddress"
                    placeholder="Enter your complete address"
                    required
                    className={styles.textarea}
                  ></textarea>
                </div>
              </div>
            )}

            {selectedServices.length > 0 && (
              <div className={styles.submitSection}>
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                  onChange={(value) => setRecaptchaValue(value)}
                />
                <button type="submit" className={styles.submitButton}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={styles.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Schedule Appointment
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Booking;
