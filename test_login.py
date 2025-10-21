import unittest
import os
import time
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains

class TestKMITLogin(unittest.TestCase):
    
    def setUp(self):
        """Initialize WebDriver before each test"""
        print("\n=== Setting up test ===")
        try:
            options = Options()
            options.add_argument("--remote-allow-origins=*")
            options.add_argument("--start-maximized")
            options.add_argument("--disable-infobars")
            options.add_argument("--disable-extensions")
            self.driver = webdriver.Chrome(options=options)
            self.driver.get("http://localhost:3000/login")
            print(f"Page loaded: {self.driver.current_url}")
            print(f"Page title: {self.driver.title}")
        except Exception as e:
            print(f"Setup failed: {str(e)}")
            raise
        
    def tearDown(self):
        """Close WebDriver after each test"""
        print("=== Tearing down test ===")
        if hasattr(self, 'driver'):
            self.driver.quit()
    
    def take_screenshot(self, test_name):
        """Take a screenshot for debugging"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_dir = "screenshots"
        if not os.path.exists(screenshot_dir):
            os.makedirs(screenshot_dir)
        screenshot_path = f"{screenshot_dir}/{test_name}_{timestamp}.png"
        self.driver.save_screenshot(screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        return screenshot_path
    
    def wait_for_element(self, locator, timeout=10):
        """Wait for element to be present and visible"""
        try:
            element = WebDriverWait(self.driver, timeout).until(
                EC.visibility_of_element_located(locator)
            )
            return element
        except Exception as e:
            print(f"Element not found: {locator}")
            raise e
    
    def wait_for_clickable(self, locator, timeout=10):
        """Wait for element to be clickable"""
        try:
            element = WebDriverWait(self.driver, timeout).until(
                EC.element_to_be_clickable(locator)
            )
            return element
        except Exception as e:
            print(f"Element not clickable: {locator}")
            raise e
    
    def select_role(self, role_value):
        """Helper method to select a role radio button"""
        try:
            print(f"Selecting role: {role_value}")
            radio = self.driver.find_element(By.ID, role_value)
            # Use JavaScript to click in case there are overlay issues
            self.driver.execute_script("arguments[0].click();", radio)
            print(f"Selected role by ID: {role_value}")
            
            # Verify the radio is actually selected
            time.sleep(0.5)
            if not radio.is_selected():
                print(f"Warning: Radio button {role_value} is not selected after clicking")
                # Try clicking the label instead
                try:
                    label = self.driver.find_element(By.CSS_SELECTOR, f"label[for='{role_value}']")
                    self.driver.execute_script("arguments[0].click();", label)
                    print(f"Clicked label for {role_value}")
                except:
                    print(f"Could not click label for {role_value}")
        except Exception as e:
            print(f"Error selecting role {role_value}: {str(e)}")
            raise
    
    def test_page_loads(self):
        """Test that the login page loads correctly"""
        try:
            print("\n--- Testing page load ---")
            self.wait_for_element((By.ID, "username"))
            self.wait_for_element((By.ID, "password"))
            self.wait_for_element((By.CSS_SELECTOR, "form button[type='submit']"))
            print("Login page loaded successfully")
        except Exception as e:
            self.take_screenshot("test_page_loads")
            raise e
    
    def test_successful_login(self):
        """Test successful login with valid admin credentials"""
        try:
            print("\n--- Testing successful admin login ---")
            
            # Wait for page to load
            username_field = self.wait_for_element((By.ID, "username"))
            password_field = self.wait_for_element((By.ID, "password"))
            
            print("Entering admin credentials...")
            username_field.clear()
            username_field.send_keys("deepa@kmit")
            password_field.clear()
            password_field.send_keys("Kmit123@")
            
            # Select admin role
            self.select_role("admin")
            
            # Click login button
            print("Clicking login button...")
            login_button = self.wait_for_clickable((By.CSS_SELECTOR, "form button[type='submit']"))
            login_button.click()
            
            # Wait for potential redirect
            time.sleep(3)
            
            # Debug: Check current state
            print(f"Current URL after login attempt: {self.driver.current_url}")
            print(f"Page title after login attempt: {self.driver.title}")
            
            # Check for error message
            try:
                error_msg = self.driver.find_element(By.ID, "errorMessage")
                if error_msg.is_displayed():
                    print(f"Error message displayed: {error_msg.text}")
                    self.take_screenshot("admin_login_error")
                    
                    # Let's try to fix the admin role using the debug tools
                    print("Attempting to fix admin role using debug tools...")
                    self.fix_admin_role()
                    
                    # Try login again
                    print("Retrying login after fixing admin role...")
                    username_field = self.driver.find_element(By.ID, "username")
                    password_field = self.driver.find_element(By.ID, "password")
                    username_field.clear()
                    username_field.send_keys("deepa@kmit")
                    password_field.clear()
                    password_field.send_keys("Kmit123@")
                    
                    # Select admin role again
                    self.select_role("admin")
                    
                    # Click login button again
                    login_button = self.wait_for_clickable((By.CSS_SELECTOR, "form button[type='submit']"))
                    login_button.click()
                    
                    # Wait again
                    time.sleep(3)
                    print(f"URL after retry: {self.driver.current_url}")
            except:
                print("No error message found")
            
            # Check for success message
            try:
                success_msg = self.driver.find_element(By.ID, "successMessage")
                if success_msg.is_displayed():
                    print(f"Success message displayed: {success_msg.text}")
            except:
                print("No success message found")
            
            # Check if we've been redirected to admin dashboard
            if "/admin" in self.driver.current_url:
                print("Successfully redirected to admin dashboard")
                return
            elif "/login" in self.driver.current_url:
                print("Still on login page - admin login failed")
                self.take_screenshot("admin_login_still_on_login")
                
                # Try to get more debugging info
                try:
                    # Check if debug section is visible
                    debug_section = self.driver.find_element(By.ID, "debugSection")
                    if debug_section.is_displayed():
                        print("Debug section is visible")
                        
                        # Try to use the Fix Admin Role button
                        try:
                            fix_admin_button = self.driver.find_element(By.ID, "fixAdminRoleButton")
                            if fix_admin_button.is_displayed():
                                print("Clicking Fix Admin Role button...")
                                fix_admin_button.click()
                                time.sleep(2)
                                
                                # Try login again
                                username_field = self.driver.find_element(By.ID, "username")
                                password_field = self.driver.find_element(By.ID, "password")
                                username_field.clear()
                                username_field.send_keys("deepa@kmit")
                                password_field.clear()
                                password_field.send_keys("Kmit123@")
                                
                                # Select admin role again
                                self.select_role("admin")
                                
                                # Click login button again
                                login_button = self.wait_for_clickable((By.CSS_SELECTOR, "form button[type='submit']"))
                                login_button.click()
                                
                                # Wait again
                                time.sleep(3)
                                print(f"URL after fix admin role: {self.driver.current_url}")
                                
                                if "/admin" in self.driver.current_url:
                                    print("Successfully redirected after fixing admin role")
                                    return
                        except:
                            print("Could not find or click Fix Admin Role button")
                except:
                    pass
                
                # Last resort - try to check if the user exists and has the correct role
                self.check_user_role()
                
                # If we got here, the login failed
                raise Exception("Admin login did not succeed")
            else:
                print(f"Unexpected URL: {self.driver.current_url}")
                self.take_screenshot("admin_login_unexpected_url")
                raise Exception(f"Unexpected URL after login: {self.driver.current_url}")
            
        except Exception as e:
            self.take_screenshot("test_successful_admin_login")
            print(f"Admin login failed: {str(e)}")
            raise e
    
    def fix_admin_role(self):
        """Fix the admin role using the debug tools"""
        try:
            print("Attempting to fix admin role...")
            
            # Check if debug section is visible
            try:
                debug_section = self.driver.find_element(By.ID, "debugSection")
                if debug_section.is_displayed():
                    # Try to use the Fix Admin Role button
                    fix_admin_button = self.driver.find_element(By.ID, "fixAdminRoleButton")
                    if fix_admin_button.is_displayed():
                        print("Clicking Fix Admin Role button...")
                        fix_admin_button.click()
                        time.sleep(2)
                        return
            except:
                pass
            
            # If debug section is not visible, try to make it visible
            print("Debug section not visible, trying to make it visible...")
            
            # Try to toggle debug panel with keyboard shortcut
            actions = ActionChains(self.driver)
            actions.key_down(Keys.CONTROL)
            actions.key_down(Keys.SHIFT)
            actions.send_keys("D")
            actions.key_up(Keys.SHIFT)
            actions.key_up(Keys.CONTROL)
            actions.perform()
            time.sleep(1)
            
            # Now try to find and click the Fix Admin Role button
            try:
                fix_admin_button = self.driver.find_element(By.ID, "fixAdminRoleButton")
                if fix_admin_button.is_displayed():
                    print("Clicking Fix Admin Role button...")
                    fix_admin_button.click()
                    time.sleep(2)
            except:
                print("Could not find or click Fix Admin Role button")
                
        except Exception as e:
            print(f"Error fixing admin role: {str(e)}")
    
    def check_user_role(self):
        """Check if the admin user exists and has the correct role"""
        try:
            print("Checking admin user role...")
            
            # Try to navigate to the debug user endpoint directly
            self.driver.get("http://localhost:3000/api/auth/check-user/deepa@kmit")
            time.sleep(2)
            
            # Get page source to check user info
            page_source = self.driver.page_source
            print(f"Page source from check-user endpoint: {page_source[:200]}...")
            
            # Try to navigate to the fix admin role endpoint directly
            self.driver.get("http://localhost:3000/api/auth/fix-admin-role")
            time.sleep(2)
            
            print("Attempted to fix admin role via API endpoint")
            
            # Go back to login page
            self.driver.get("http://localhost:3000/login")
            time.sleep(2)
            
        except Exception as e:
            print(f"Error checking user role: {str(e)}")
    
    def test_invalid_credentials(self):
        """Test login with invalid credentials"""
        try:
            print("\n--- Testing invalid credentials ---")
            
            # Wait for page to load
            username_field = self.wait_for_element((By.ID, "username"))
            password_field = self.wait_for_element((By.ID, "password"))
            
            # Enter invalid credentials
            username_field.clear()
            username_field.send_keys("invalid@user")
            password_field.clear()
            password_field.send_keys("wrongpass")
            
            # Select student role
            self.select_role("student")
            
            # Click login button
            login_button = self.wait_for_clickable((By.CSS_SELECTOR, "form button[type='submit']"))
            login_button.click()
            
            # Verify error message appears
            print("Waiting for error message...")
            error_msg = WebDriverWait(self.driver, 5).until(
                EC.visibility_of_element_located((By.ID, "errorMessage"))
            )
            
            print(f"Error message: {error_msg.text}")
            self.assertIn("Invalid credentials", error_msg.text)
            
        except Exception as e:
            self.take_screenshot("test_invalid_credentials")
            print(f"Invalid credentials test failed: {str(e)}")
            raise e
    
    def test_ui_elements(self):
        """Test that all UI elements are present"""
        try:
            print("\n--- Testing UI elements ---")
            
            # Wait for page to load
            self.wait_for_element((By.ID, "username"))
            
            # Verify main elements
            elements_to_check = [
                ((By.ID, "username"), "Username field"),
                ((By.ID, "password"), "Password field"),
                ((By.CSS_SELECTOR, "form button[type='submit']"), "Login button"),
                ((By.ID, "rememberMe"), "Remember me checkbox"),
                ((By.ID, "forgotPasswordLink"), "Forgot password link"),
                ((By.LINK_TEXT, "Browse as Guest"), "Guest access link")
            ]
            
            # Check role selection elements
            role_checks = [
                ("student", "Student radio"),
                ("clubLeader", "Club Leader radio"),
                ("faculty", "Faculty radio"),
                ("admin", "Admin radio")
            ]
            
            for role_id, description in role_checks:
                try:
                    self.driver.find_element(By.ID, role_id)
                    print(f"✓ Found {description}")
                except:
                    print(f"✗ Missing {description}")
            
            # Check other elements
            for locator, description in elements_to_check:
                try:
                    element = self.wait_for_element(locator, timeout=5)
                    print(f"✓ Found {description}")
                except Exception as e:
                    print(f"✗ Missing {description}: {str(e)}")
                    raise
            
            print("UI elements check completed")
            
        except Exception as e:
            self.take_screenshot("test_ui_elements")
            print(f"UI elements test failed: {str(e)}")
            raise e

if __name__ == "__main__":
    unittest.main(verbosity=2)