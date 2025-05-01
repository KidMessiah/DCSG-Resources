import os
import json
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path

class PDFImporterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("PDF Importer Tool")
        self.root.geometry("600x500")
        self.root.resizable(True, True)
        
        self.current_file_index = 0
        self.pdf_files = []
        self.list_json_path = os.path.join("content", "list.json")
        self.pdfs_dir = "pdfs"
        
        # Load existing entries
        self.existing_entries = self.load_existing_entries()
        self.existing_paths = [entry["path"] for entry in self.existing_entries]
        
        # Find PDF files
        self.scan_pdfs()
        
        # Create UI
        self.create_ui()
        
        # Start processing if files exist
        if self.pdf_files:
            self.update_current_file_ui()
        else:
            messagebox.showinfo("No Files", "No new PDF files found to import.")
            self.root.quit()
    
    def load_existing_entries(self):
        try:
            with open(self.list_json_path, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def scan_pdfs(self):
        if not os.path.exists(self.pdfs_dir):
            messagebox.showerror("Error", f"PDF directory '{self.pdfs_dir}' not found!")
            return
        
        # Get all PDF files
        all_pdfs = [f for f in os.listdir(self.pdfs_dir) if f.lower().endswith('.pdf')]
        
        # Filter out PDFs already in list.json
        self.pdf_files = []
        for pdf in all_pdfs:
            pdf_path = f"pdfs/{pdf}"
            if pdf_path not in self.existing_paths:
                self.pdf_files.append(pdf)
    
    def create_ui(self):
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        
        # Progress information
        self.progress_label = ttk.Label(main_frame, text="")
        self.progress_label.grid(row=0, column=0, columnspan=2, sticky=tk.W, pady=(0, 10))
        
        # File name display
        ttk.Label(main_frame, text="File:").grid(row=1, column=0, sticky=tk.W)
        self.file_label = ttk.Label(main_frame, text="", font=("", 10, "bold"))
        self.file_label.grid(row=1, column=1, sticky=tk.W)
        
        # Form fields
        ttk.Label(main_frame, text="Title:").grid(row=2, column=0, sticky=tk.W, pady=(10, 0))
        self.title_var = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.title_var, width=50).grid(row=2, column=1, sticky=(tk.W, tk.E), pady=(10, 0))
        
        ttk.Label(main_frame, text="Description:").grid(row=3, column=0, sticky=tk.W, pady=(10, 0))
        self.desc_var = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.desc_var, width=50).grid(row=3, column=1, sticky=(tk.W, tk.E), pady=(10, 0))
        
        ttk.Label(main_frame, text="Category:").grid(row=4, column=0, sticky=tk.W, pady=(10, 0))
        
        # Create a combobox with existing categories and allow new ones
        existing_categories = sorted(list(set(entry["category"] for entry in self.existing_entries if "category" in entry)))
        self.category_var = tk.StringVar()
        self.category_combo = ttk.Combobox(main_frame, textvariable=self.category_var, values=existing_categories, width=47)
        self.category_combo.grid(row=4, column=1, sticky=(tk.W, tk.E), pady=(10, 0))
        
        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=5, column=0, columnspan=2, pady=(20, 0))
        
        ttk.Button(button_frame, text="Skip", command=self.skip_current).grid(row=0, column=0, padx=5)
        ttk.Button(button_frame, text="Add", command=self.add_current).grid(row=0, column=1, padx=5)
        
        # Configure grid weights
        main_frame.columnconfigure(1, weight=1)
        
        # Status bar
        self.status_var = tk.StringVar()
        status_bar = ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        status_bar.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.S))
        self.status_var.set("Ready")
    
    def update_current_file_ui(self):
        if self.current_file_index < len(self.pdf_files):
            current_file = self.pdf_files[self.current_file_index]
            self.file_label.config(text=current_file)
            
            # Set progress info
            self.progress_label.config(text=f"Processing file {self.current_file_index + 1} of {len(self.pdf_files)}")
            
            # Set a default title (filename without extension)
            filename_without_ext = os.path.splitext(current_file)[0]
            self.title_var.set(filename_without_ext)
            
            # Clear other fields
            self.desc_var.set("")
            self.category_var.set("")
            
            self.status_var.set(f"Editing metadata for {current_file}")
        else:
            self.finish_importing()
    
    def add_current(self):
        if self.current_file_index >= len(self.pdf_files):
            return
        
        current_file = self.pdf_files[self.current_file_index]
        
        # Create entry for the JSON file
        new_entry = {
            "title": self.title_var.get(),
            "description": self.desc_var.get(),
            "path": f"pdfs/{current_file}",
            "category": self.category_var.get(),
            "type": "pdf"
        }
        
        # Add to existing entries
        self.existing_entries.append(new_entry)
        self.existing_paths.append(new_entry["path"])
        
        # Move to next file
        self.current_file_index += 1
        if self.current_file_index < len(self.pdf_files):
            self.update_current_file_ui()
        else:
            self.finish_importing()
    
    def skip_current(self):
        self.current_file_index += 1
        if self.current_file_index < len(self.pdf_files):
            self.update_current_file_ui()
        else:
            self.finish_importing()
    
    def finish_importing(self):
        # Save the updated JSON file
        try:
            # Ensure the content directory exists
            os.makedirs(os.path.dirname(self.list_json_path), exist_ok=True)
            
            with open(self.list_json_path, 'w') as f:
                json.dump(self.existing_entries, f, indent=2)
            
            messagebox.showinfo("Success", f"Updated {self.list_json_path} with {len(self.existing_entries)} entries")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save JSON: {str(e)}")
        
        self.root.quit()

if __name__ == "__main__":
    root = tk.Tk()
    app = PDFImporterApp(root)
    root.mainloop()
