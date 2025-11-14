/**
 * File System Access Hook
 *
 * Manages access to user's file system using the File System Access API.
 * Allows reading/writing files within a user-selected directory.
 */

"use client";

import { useState, useCallback } from "react";

export type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
};

type UseFileSystemAccessResult = {
  rootDirectory: FileSystemDirectoryHandle | null;
  fileTree: FileNode | null;
  isScanning: boolean;
  selectDirectory: () => Promise<void>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  getFileTree: () => FileNode | null;
  clearDirectory: () => void;
};

export function useFileSystemAccess(): UseFileSystemAccessResult {
  const [rootDirectory, setRootDirectory] = useState<FileSystemDirectoryHandle | null>(null);
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  /**
   * Build file tree from directory handle
   */
  const buildFileTree = async (
    dirHandle: FileSystemDirectoryHandle,
    currentPath: string = ""
  ): Promise<FileNode> => {
    const node: FileNode = {
      name: dirHandle.name,
      path: currentPath || dirHandle.name,
      type: "directory",
      children: [],
      handle: dirHandle,
    };

    try {
      // @ts-ignore - FileSystemDirectoryHandle is iterable
      for await (const entry of dirHandle.values()) {
        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

        if (entry.kind === "file") {
          node.children!.push({
            name: entry.name,
            path: entryPath,
            type: "file",
            handle: entry as FileSystemFileHandle,
          });
        } else if (entry.kind === "directory") {
          // Skip node_modules, .git, and other common large directories
          if (
            entry.name === "node_modules" ||
            entry.name === ".git" ||
            entry.name === ".next" ||
            entry.name === "dist" ||
            entry.name === "build" ||
            entry.name === ".turbo"
          ) {
            continue;
          }

          const subTree = await buildFileTree(entry as FileSystemDirectoryHandle, entryPath);
          node.children!.push(subTree);
        }
      }
    } catch (error) {
      console.error("Error building file tree:", error);
    }

    return node;
  };

  /**
   * Let user select a directory
   */
  const selectDirectory = useCallback(async () => {
    try {
      // Check if File System Access API is supported
      if (!("showDirectoryPicker" in window)) {
        alert(
          "File System Access API is not supported in your browser. Please use Chrome or Edge."
        );
        return;
      }

      // @ts-ignore - showDirectoryPicker is not in TypeScript types yet
      const dirHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });

      setRootDirectory(dirHandle);
      setIsScanning(true);

      // Build file tree
      const tree = await buildFileTree(dirHandle);
      setFileTree(tree);
      setIsScanning(false);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error selecting directory:", error);
        alert("Failed to access directory. Please try again.");
      }
      setIsScanning(false);
    }
  }, []);

  /**
   * Find file handle by path
   */
  const findFileHandle = useCallback(
    async (path: string): Promise<FileSystemFileHandle | null> => {
      if (!rootDirectory) return null;

      try {
        const parts = path.split("/").filter((p) => p.length > 0);
        let currentHandle: FileSystemDirectoryHandle | FileSystemFileHandle = rootDirectory;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];

          if (i === parts.length - 1) {
            // Last part - should be a file
            currentHandle = await (currentHandle as FileSystemDirectoryHandle).getFileHandle(part);
          } else {
            // Directory
            currentHandle = await (currentHandle as FileSystemDirectoryHandle).getDirectoryHandle(
              part
            );
          }
        }

        return currentHandle as FileSystemFileHandle;
      } catch (error) {
        console.error(`Error finding file at path ${path}:`, error);
        return null;
      }
    },
    [rootDirectory]
  );

  /**
   * Read file content
   */
  const readFile = useCallback(
    async (path: string): Promise<string> => {
      const fileHandle = await findFileHandle(path);
      if (!fileHandle) {
        throw new Error(`File not found: ${path}`);
      }

      const file = await fileHandle.getFile();
      const content = await file.text();
      return content;
    },
    [findFileHandle]
  );

  /**
   * Write file content
   */
  const writeFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      if (!rootDirectory) {
        throw new Error("No directory selected");
      }

      try {
        const parts = path.split("/").filter((p) => p.length > 0);
        let currentHandle: FileSystemDirectoryHandle = rootDirectory;

        // Navigate to the directory
        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: true });
        }

        // Get or create the file
        const fileName = parts[parts.length - 1];
        const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });

        // Write content
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        // Refresh file tree
        setIsScanning(true);
        const tree = await buildFileTree(rootDirectory);
        setFileTree(tree);
        setIsScanning(false);
      } catch (error) {
        console.error("Error writing file:", error);
        throw error;
      }
    },
    [rootDirectory]
  );

  /**
   * Delete file (with confirmation)
   */
  const deleteFile = useCallback(
    async (path: string): Promise<void> => {
      if (!rootDirectory) {
        throw new Error("No directory selected");
      }

      try {
        const parts = path.split("/").filter((p) => p.length > 0);
        let currentHandle: FileSystemDirectoryHandle = rootDirectory;

        // Navigate to the parent directory
        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
        }

        // Delete the file
        const fileName = parts[parts.length - 1];

        // Note: We don't show confirm() here because the AI will be deleting files
        // The confirmation should happen at the AI level through the system prompt
        await currentHandle.removeEntry(fileName);

        // Refresh file tree
        setIsScanning(true);
        const tree = await buildFileTree(rootDirectory);
        setFileTree(tree);
        setIsScanning(false);
      } catch (error) {
        console.error("Error deleting file:", error);
        throw error;
      }
    },
    [rootDirectory]
  );

  /**
   * Get current file tree
   */
  const getFileTree = useCallback(() => {
    return fileTree;
  }, [fileTree]);

  /**
   * Clear selected directory
   */
  const clearDirectory = useCallback(() => {
    setRootDirectory(null);
    setFileTree(null);
  }, []);

  return {
    rootDirectory,
    fileTree,
    isScanning,
    selectDirectory,
    readFile,
    writeFile,
    deleteFile,
    getFileTree,
    clearDirectory,
  };
}
