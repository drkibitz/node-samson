Samson
===========

A very useful build step; read any number of files, process them as JavaScript templates, and save output to another destination.

Install
===========

With npm this module prefers global installation:

    npm i samson -g

Run
===========

Output help (possible options):

	samson
	samson -h
	samson --help

Process a single file and output to console:

    samson path/to/file

Process a single file and output to file system:

    samson path/to/file -o path/to/directory

Process multiple files and output to file system:

    samson path/to/file1 path/to/file2 path/to/file3 -o path/to/directory

Process a single directory recursively and output to file system:

    samson path/to/directory -o path/to/directory

Process multiple files and directories recursively and output to file system:

    samson path/to/directory1 path/to/file path/to/directory2 -o path/to/directory

Process an input directory to an output directory recursively:

    samson -i path/to/directory -o path/to/other/directory -R

Process glob patterns to an output directory recursively:

    samson -i path/to/* -o path/to/other/directory -R

