import React, { useState, useEffect, useRef } from 'react';
import PageWrapper from '../components/PageWrapper';
import apiClient, { appointmentsApi } from '../services/api';
import styles from '../styles/Dashboard.module.css';
import { FaCalendarAlt, FaBell, FaChartLine, FaCheck, FaClock, FaTimes, FaUser } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const Dashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [revenueHistory, setRevenueHistory] = useState([]);
  const [currentMonthRevenue, setCurrentMonthRevenue] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [processedAppointmentIds, setProcessedAppointmentIds] = useState(new Set());
  const notificationRef = useRef(null);

  // Handle clicks outside notification panel to close it
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load processed appointment IDs from localStorage on component mount
  useEffect(() => {
    try {
      const savedIds = localStorage.getItem('processedAppointmentIds');
      if (savedIds) {
        setProcessedAppointmentIds(new Set(JSON.parse(savedIds)));
      }
    } catch (error) {
      console.error("Error loading processed appointment IDs:", error);
    }
  }, []);

  // Fetch all necessary data when component mounts
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const appointmentsData = await fetchAppointments();
        await fetchRevenueHistory();
        
        // Check for new pending appointments
        checkForNewAppointments(appointmentsData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchAllData();
    // Refresh data every 2 minutes
    const interval = setInterval(fetchAllData, 120000);
    return () => clearInterval(interval);
  }, []);

  // Check for new appointments and create notifications
  const checkForNewAppointments = (newAppointments) => {
    if (!newAppointments) return;
    
    // Filter for new pending appointments that weren't already processed
    const newPendingAppointments = newAppointments.filter(
      app => app.status && 
      app.status.toLowerCase() === 'pending' && 
      !processedAppointmentIds.has(app.id)
    );
    
    // Create notifications for new pending appointments
    if (newPendingAppointments.length > 0) {
      const newNotifications = newPendingAppointments.map(app => ({
        id: `notif-${app.id}`,
        title: 'New Pending Appointment',
        message: `${app.name} has requested an appointment`,
        time: new Date(),
        appointmentId: app.id,
        read: false
      }));
      
      // Update notifications state - properly merging and deduplicating
      setNotifications(prev => {
        // Remove any duplicates by appointmentId
        const uniqueNotifications = [...prev];
        newNotifications.forEach(newNotif => {
          const existingIndex = uniqueNotifications.findIndex(
            existingNotif => existingNotif.appointmentId === newNotif.appointmentId
          );
          
          if (existingIndex >= 0) {
            uniqueNotifications.splice(existingIndex, 1);
          }
          
          uniqueNotifications.unshift(newNotif); // Add to beginning
        });
        
        return uniqueNotifications;
      });
      
      // Add the processed appointment IDs to avoid duplicates
      const updatedProcessedIds = new Set(processedAppointmentIds);
      newPendingAppointments.forEach(app => updatedProcessedIds.add(app.id));
      setProcessedAppointmentIds(updatedProcessedIds);
      
      // Save processed IDs to localStorage
      localStorage.setItem('processedAppointmentIds', JSON.stringify([...updatedProcessedIds]));
    }
  };

  // Update unread count whenever notifications change
  useEffect(() => {
    const actualUnreadCount = notifications.filter(n => !n.read).length;
    setUnreadCount(actualUnreadCount);
  }, [notifications]);

  // Fetch all appointments
  const fetchAppointments = async () => {
    try {
      const response = await appointmentsApi.getAll();
      let data = response.data;
      if (!Array.isArray(data)) data = [data];
      setAppointments(data);
      return data;
    } catch (error) {
      console.error("Error fetching appointments:", error);
      return [];
    }
  };

  // Fetch revenue history
  const fetchRevenueHistory = async () => {
    try {
      const response = await apiClient.get('/revenue-history');
      if (response.data && response.data.history) {
        const history = response.data.history;
        setRevenueHistory(history);
        
        // Calculate current month revenue
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const monthlyRevenue = history.reduce((sum, entry) => {
          const entryDate = new Date(entry.revenue_date);
          if (entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear) {
            return sum + parseFloat(entry.total_revenue);
          }
          return sum;
        }, 0);
        
        setCurrentMonthRevenue(monthlyRevenue);
        return history;
      } else {
        setRevenueHistory([]);
        setCurrentMonthRevenue(0);
        return [];
      }
    } catch (error) {
      console.error("Error fetching revenue history:", error);
      setRevenueHistory([]);
      setCurrentMonthRevenue(0);
      return [];
    }
  };

  // Calculate appointment statistics for the summary cards
  const getAppointmentStats = () => {
    const total = appointments.length;
    const pending = appointments.filter(a => a.status && a.status.toLowerCase() === 'pending').length;
    const accepted = appointments.filter(a => a.status && a.status.toLowerCase() === 'accepted').length;
    const completed = appointments.filter(a => a.status && a.status.toLowerCase() === 'completed').length;
    const rejected = appointments.filter(a => a.status && a.status.toLowerCase() === 'rejected').length;
    
    return { total, pending, accepted, completed, rejected };
  };

  // Handle notification click - just mark as read
  const handleNotificationClick = (notification) => {
    // Mark notification as read
    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? {...n, read: true} : n
      )
    );
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    setShowNotifications(false);
    
    // Note: We don't clear processedAppointmentIds here
    // to prevent the same notifications from appearing again
  };

  // Format time for notifications
  const formatNotificationTime = (date) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMinutes = Math.floor((now - notifDate) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return notifDate.toLocaleDateString();
  };

  // Get current month name
  const getCurrentMonthName = () => {
    return new Date().toLocaleString('default', { month: 'long' });
  };

  // Sync notifications with pending appointments (one time setup)
  useEffect(() => {
    // This effect runs once when appointments are first loaded
    const hasNotifications = notifications.length > 0;
    
    if (!hasNotifications && appointments.length > 0) {
      // Initial setup - create notifications for existing pending appointments
      // that haven't been processed yet
      const pendingAppointments = appointments.filter(a => 
        a.status && 
        a.status.toLowerCase() === 'pending' && 
        !processedAppointmentIds.has(a.id)
      );
      
      if (pendingAppointments.length > 0) {
        // Create notifications without duplicating the check logic
        checkForNewAppointments(appointments);
      }
    }
  }, [appointments.length]);

  const stats = getAppointmentStats();

  return (
    <PageWrapper>
      <div className={styles.container}>
        {/* Top Navigation Bar */}
        <div className={styles.topNav}>
          <div className={styles.topNavInner}>
            <div className={styles.topNavContent}>
              <h1 className={styles.dashboardTitle}>
                <span className={styles.titleIcon}>
                  <FaChartLine className="h-5 w-5" />
                </span>
                Admin Dashboard
              </h1>
              
              {/* Right side controls */}
              <div className={styles.controls}>
                {/* Date display */}
                <div className={styles.dateDisplay}>
                  <FaCalendarAlt className={styles.dateIcon} />
                  <span>
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                
                {/* Notification Bell */}
                <div className={styles.notificationWrapper} ref={notificationRef}>
                  <button 
                    className={styles.notificationButton}
                    onClick={() => setShowNotifications(!showNotifications)}
                  >
                    <FaBell className={styles.notificationIcon} />
                    {unreadCount > 0 && (
                      <span className={styles.badge}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  
                  {/* Notification Panel */}
                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className={styles.notificationPanel}
                      >
                        <div className={styles.notificationHeader}>
                          <h3 className={styles.notificationTitle}>Notifications</h3>
                          {notifications.length > 0 && (
                            <button 
                              onClick={clearAllNotifications}
                              className={styles.clearButton}
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        
                        <div className={styles.notificationList}>
                          {notifications.length === 0 ? (
                            <div className={styles.notificationEmpty}>
                              <p>No new notifications</p>
                            </div>
                          ) : (
                            notifications.map(notification => (
                              <div 
                                key={notification.id}
                                className={`${styles.notificationItem} ${!notification.read ? styles.notificationItemUnread : ''}`}
                                onClick={() => handleNotificationClick(notification)}
                              >
                                <div className={styles.notificationContent}>
                                  <div className={styles.notificationText}>
                                    <p className={styles.notificationTitle}>{notification.title}</p>
                                    <p className={styles.notificationMessage}>{notification.message}</p>
                                  </div>
                                  <span className={styles.notificationTime}>
                                    {formatNotificationTime(notification.time)}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* User Profile */}
                <div className={styles.userProfile}>
                  <FaUser className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className={styles.mainContent}>
          {/* Stats Overview */}
          <div className={styles.statsGrid}>
            {/* Total Appointments Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={styles.statsCard}
            >
              <div className={styles.statsHeader}>
                <div>
                  <p className={styles.statsLabel}>Total Appointments</p>
                  <h3 className={styles.statsValue}>{stats.total}</h3>
                </div>
                <div className={`${styles.iconWrapper} ${styles.blueIcon}`}>
                  <FaCalendarAlt className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className={styles.progressBar}>
                <div className={`${styles.progressFill} ${styles.blueFill}`} style={{ width: '100%' }}></div>
              </div>
            </motion.div>
            
            {/* Pending Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className={styles.statsCard}
            >
              <div className={styles.statsHeader}>
                <div>
                  <p className={styles.statsLabel}>Pending</p>
                  <h3 className={styles.statsValue}>{stats.pending}</h3>
                </div>
                <div className={`${styles.iconWrapper} ${styles.amberIcon}`}>
                  <FaClock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={`${styles.progressFill} ${styles.amberFill}`}
                  style={{ width: `${stats.total ? Math.round((stats.pending / stats.total) * 100) : 0}%` }}
                ></div>
              </div>
              {stats.pending > 0 && (
                <div className={styles.alertText}>
                  <span className={styles.alertDot}>
                    <span className={styles.alertDotPing}></span>
                    <span className={styles.alertDotCenter}></span>
                  </span>
                  Requires attention
                </div>
              )}
            </motion.div>
            
            {/* Accepted Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className={styles.statsCard}
            >
              <div className={styles.statsHeader}>
                <div>
                  <p className={styles.statsLabel}>Accepted</p>
                  <h3 className={styles.statsValue}>{stats.accepted}</h3>
                </div>
                <div className={`${styles.iconWrapper} ${styles.greenIcon}`}>
                  <FaCheck className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className={styles.progressBar}>
                <div className={`${styles.progressFill} ${styles.greenFill}`}
                     style={{ width: `${stats.total ? Math.round((stats.accepted / stats.total) * 100) : 0}%` }}></div>
              </div>
            </motion.div>
            
            {/* Completed Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className={styles.statsCard}
            >
              <div className={styles.statsHeader}>
                <div>
                  <p className={styles.statsLabel}>Completed</p>
                  <h3 className={styles.statsValue}>{stats.completed}</h3>
                </div>
                <div className={`${styles.iconWrapper} ${styles.purpleIcon}`}>
                  <FaCheck className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <div className={styles.progressBar}>
                <div className={`${styles.progressFill} ${styles.purpleFill}`}
                     style={{ width: `${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%` }}></div>
              </div>
            </motion.div>
            
            {/* Revenue Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className={styles.statsCard}
            >
              <div className={styles.statsHeader}>
                <div>
                  <p className={styles.statsLabel}>{getCurrentMonthName()} Revenue</p>
                  <h3 className={styles.statsValue}>
                    ₱{currentMonthRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className={`${styles.iconWrapper} ${styles.skyIcon}`}>
                  <FaChartLine className="h-5 w-5 text-sky-600" />
                </div>
              </div>
              <div className={styles.progressBar}>
                <div className={`${styles.progressFill} ${styles.skyFill}`} style={{ width: '60%' }}></div>
              </div>
            </motion.div>
          </div>
          
          {/* Performance Metrics Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
            className={styles.metricsSection}
          >
            <h2 className={styles.metricsTitle}>
              <span className={styles.metricsTitleIcon}>
                <FaChartLine className="h-5 w-5 text-indigo-600" />
              </span>
              Performance Metrics
            </h2>
            <div className={styles.metricsGrid}>
              {/* Acceptance Rate */}
              <div className={styles.metricsCard}>
                <div className={styles.metricsHeader}>
                  <span className={styles.metricsLabel}>Acceptance Rate</span>
                  <span className={styles.metricsValue}>
                    {stats.total ? Math.round((stats.accepted / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={`${styles.progressFill} ${styles.blueFill}`} 
                    style={{ width: `${stats.total ? Math.round((stats.accepted / stats.total) * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Completion Rate */}
              <div className={styles.metricsCard}>
                <div className={styles.metricsHeader}>
                  <span className={styles.metricsLabel}>Completion Rate</span>
                  <span className={styles.metricsValue}>
                    {stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={`${styles.progressFill} ${styles.greenFill}`}
                    style={{ width: `${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Rejection Rate */}
              <div className={styles.metricsCard}>
                <div className={styles.metricsHeader}>
                  <span className={styles.metricsLabel}>Rejection Rate</span>
                  <span className={styles.metricsValue}>
                    {stats.total ? Math.round((stats.rejected / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={`${styles.progressFill} ${styles.redFill}`}
                    style={{ width: `${stats.total ? Math.round((stats.rejected / stats.total) * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Dashboard;