from wiktionaryparser import WiktionaryParser
from os import mkdir
from os.path import exists, isdir
import json
import time
import threading


OUTPUT_FOLDER = "./output"
INPUT_FILE = "./dutch_words.txt"
NUM_THREADS = 8


parser = WiktionaryParser()
words = ["echt", "kat", "klaar"]
input_lines = None
progress_counter = 0
thread_lock = threading.Lock()


if not exists(OUTPUT_FOLDER):
    mkdir(OUTPUT_FOLDER)


if not isdir(OUTPUT_FOLDER):
    raise Exception("output folder name is taken by a file")


with open(INPUT_FILE) as file:
    input_lines = [line.rstrip() for line in file]


def fetch_word(word, thread_name):
    filename = OUTPUT_FOLDER + "/" + word + ".json"

    if exists(filename):
        return

    result = None

    while True:
        try:
            result = parser.fetch(word, "dutch")

            if len(result) == 0:
                time.sleep(1)
                continue;

            break
        except Exception:
            time.sleep(1)
            print("Rate limited, pausing " + thread_name + "...")

    json_string = json.dumps(result)
    with open(filename, "w") as file:
        file.write(json_string)


def calculate_range(index):
    len_input_lines = len(input_lines)
    per_thread = len_input_lines // NUM_THREADS
    return (
        index * per_thread,
        len_input_lines
        if index == NUM_THREADS - 1
        else index * per_thread + per_thread,
    )


def start_fetching_thread(thread_name, index_range):
    print(thread_name + ": Started!")
    for index in range(index_range[0], index_range[1]):
        word = input_lines[index]
        print(thread_name + ': Fetching "' + word + '"...')
        fetch_word(word, thread_name)
        print(thread_name + ': Fetched "' + word + '"!')

        with thread_lock:
            global progress_counter
            progress_counter += 1
            print("Completed " + str(progress_counter) + "/" + str(len(input_lines)))

    print(thread_name + ": Finished!")


if __name__ == "__main__":
    threads = [
        threading.Thread(
            target=start_fetching_thread, args=("thread " + str(i), calculate_range(i))
        )
        for i in range(NUM_THREADS)
    ]

    for i in range(0, len(threads)):
        thread = threads[i]
        thread.name = "thread " + str(i)
        thread.start()

    for thread in threads:
        thread.join()
