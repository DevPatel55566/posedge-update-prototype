import sys
import time
import subprocess
import os
import pyautogui
import pygetwindow as gw

# Safety: move mouse to top left corner to abort
pyautogui.FAILSAFE = True

def log(msg):
    print(f"[PYTHON] {msg}", flush=True)

def focus_installer():
    """Brings the installer window to the front."""
    try:
        windows = gw.getWindowsWithTitle('Universal POS Setup')
        if windows:
            windows[0].activate()
            time.sleep(0.5)
    except Exception:
        pass

def find_and_click(image_name, timeout=15):
    """Waits for an image to appear, moves the mouse, and clicks it."""
    log(f"Looking for {image_name}...")
    start_time = time.time()
    image_path = os.path.join(os.path.dirname(__file__), image_name)
    
    if not os.path.exists(image_path):
        log(f"ERROR: Image file '{image_name}' is missing from the agent folder!")
        return False

    while time.time() - start_time < timeout:
        try:
            # Lowered confidence to 0.6 to make it much more forgiving
            location = pyautogui.locateCenterOnScreen(image_path, confidence=0.6, grayscale=True)
            if location:
                log(f"Found {image_name} at {location}. MOVING MOUSE and clicking...")
                pyautogui.moveTo(location.x, location.y, duration=0.5)
                pyautogui.click()
                time.sleep(1.5) 
                return True
        except Exception as e:
            pass 
            
        time.sleep(0.5)
        
    log(f"Timeout: Could not find {image_name} on screen.")
    return False

def is_process_running(process_name):
    try:
        output = subprocess.check_output(f'tasklist /FI "IMAGENAME eq {process_name}"', shell=True).decode('utf-8', errors='ignore')
        return process_name.lower() in output.lower()
    except Exception:
        return False

def main():
    if len(sys.argv) < 2:
        log("No installer path provided.")
        sys.exit(1)

    installer_path = sys.argv[1]
    log(f"Launching installer: {installer_path}")

    subprocess.Popen(f'start "" "{installer_path}"', shell=True)
    
    log("Waiting 5 seconds for Warning Dialog...")
    time.sleep(5)
    focus_installer()

    try:
        # --- STEP 1: Warning Dialog ---
        log("Step 1: Dismissing Warning Dialog...")
        if not find_and_click("btn_ok.png", timeout=10):
            pyautogui.press('enter')
        time.sleep(2) 
        focus_installer()

        # --- STEP 2: Welcome Screen ---
        log("Step 2: Welcome Screen...")
        if not find_and_click("btn_next.png", timeout=10):
            pyautogui.press('enter')
        time.sleep(2) 
        focus_installer()

        # --- STEP 3: License Agreement ---
        log("Step 3: License Agreement...")
        # This should now successfully find the image and move the mouse!
        if not find_and_click("chk_license.png", timeout=10):
            log("Image not found. Using safe keyboard fallback.")
            pyautogui.press('tab')
            time.sleep(0.5)
            pyautogui.press('space')
            
        time.sleep(1.5) 
        if not find_and_click("btn_next.png", timeout=10):
            pyautogui.press('enter')
        time.sleep(2) 
        focus_installer()

        # --- STEP 4: Choose Components ---
        log("Step 4: Components Screen...")
        if not find_and_click("chk_backup.png", timeout=10):
            log("Image not found. Using safe keyboard fallback.")
            pyautogui.press('space') 
        time.sleep(1.5)
        if not find_and_click("btn_next.png", timeout=10):
            pyautogui.press('enter')
        time.sleep(2) 
        focus_installer()

        # --- STEP 5: Choose Install Location ---
        log("Step 5: Install Location...")
        if not find_and_click("btn_install.png", timeout=15):
            pyautogui.press('enter')

        # --- STEP 6: Completing Screen ---
        log("Step 6: Waiting for installation to complete (up to 2 minutes)...")
        if find_and_click("chk_readme.png", timeout=120):
            log("Found Readme checkbox. MOVING MOUSE to uncheck...")
            time.sleep(1)
            if not find_and_click("btn_finish.png", timeout=10):
                pyautogui.press('enter')
            log("Clicked Finish!")
        else:
            log("Timeout waiting for finish screen. Using blind keyboard fallback (Space + Enter)...")
            pyautogui.press('space')
            time.sleep(1)
            pyautogui.press('enter')
        
        # --- STEP 7: Database Upgrade ---
        log("Step 7: Waiting up to 40 seconds for SystemManager.exe to launch...")
        system_manager_started = False
        start_time = time.time()
        
        while time.time() - start_time < 40:
            if is_process_running("SystemManager.exe"):
                system_manager_started = True
                break
            time.sleep(2)
            
        if system_manager_started:
            log("SystemManager.exe detected! Waiting 3 seconds for prompt to render...")
            time.sleep(3)
            pyautogui.press('tab')
            time.sleep(1)
            pyautogui.press('enter')
            log("Waiting 5 seconds for Prompt 2...")
            time.sleep(5)
            pyautogui.press('enter')
            log("Database upgrade sequence complete.")
        else:
            log("SystemManager.exe did not launch within 40 seconds. Skipping upgrade prompts.")
            
    except Exception as e:
        log(f"Automation Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()