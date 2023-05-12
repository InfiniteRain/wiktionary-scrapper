class Task {
  constructor(executor) {
    this.executor = executor;
    this.promise = null;
  }

  start() {
    if (this.promise) {
      return this.promise;
    }

    this.promise = new Promise(this.executor);

    return this.promise;
  }
}

const startAsyncExecutionQueue = (maxTasks, tasks) => {
  maxTasks = tasks.length > maxTasks ? maxTasks : tasks.length;

  return new Promise((resolve) => {
    let currentIndex = 0;
    let results = [];
    let runningTasks = 0;

    const nextTask = () => {
      if (currentIndex === tasks.length) {
        if (runningTasks === 0) {
          resolve(results);
        }
        return;
      }

      const index = currentIndex++;
      const task = tasks[index];
      runningTasks++;

      task
        .start()
        .then((result) => {
          results[index] = result;
        })
        .catch((e) => {
          results[index] = e;
        })
        .finally(() => {
          runningTasks--;
          nextTask();
        });
    };

    for (let i = 0; i < maxTasks; i++) {
      nextTask();
    }
  });
};

export { Task, startAsyncExecutionQueue };
