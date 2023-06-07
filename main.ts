import { ZBClient } from "zeebe-node";
import { v4 as uuid } from "uuid";
import { config } from "dotenv";
import axios from "axios";

config();
const zbc = new ZBClient();

const baseURL = "http://localhost:3000";

interface ProcessPayload {
  employee_id: number;
  date: string;
  sum: number;
  description: string;
  current_year_expenses?: number;
  account?: boolean;
}

zbc.createWorker<ProcessPayload, {}, Partial<ProcessPayload>>({
  taskType: "check_account",
  taskHandler: async (job) => {
    // Überprüfe auf Konto
    console.log(`Überprüfe auf Konto...`);

    return await axios
      .get(`${baseURL}/accounts/${job.variables.employee_id}`)
      .then(function (response) {
        if (response.status === 200) {
          console.log(
            `Account exists for employee: ${job.variables.employee_id}`
          );
          return job.complete({ account: true });
        } else 
        return job.error(`DBnotReachable`);
      })
      .catch(function (error) {
        if (error.response.status === 404) {
          console.log(
            `Account does not exist for employee: ${job.variables.employee_id}`
          );
          return job.complete({ account: false });
        }
        return job.error(`DBnotReachable`);
      });
  },
});

zbc.createWorker<ProcessPayload, {}, Partial<ProcessPayload>>({
  taskType: "create_account",
  taskHandler: async (job) => {
    // Erstelle neues Konto
    console.log("Erstelle neues Konto...");

    const accountData = {
      id: job.variables.employee_id,
      balance: 0,
      current_year_expenses: 0,
    };

    return await axios
      .post(`${baseURL}/accounts`, accountData)
      .then(function (response) {
        console.log("Konto erfolgreich erstellt");
        return job.complete();
      })
      .catch(function (error) {
        return job.error(`DBnotReachable`);
      });
  },
});

zbc.createWorker<ProcessPayload, {}, Partial<ProcessPayload>>({
  taskType: "approve_expense",
  taskHandler: async (job) => {
    var accountData = {
      balance: -1,
      current_year_expenses: -1,
    };

    await axios
      .get(`${baseURL}/accounts/${job.variables.employee_id}`)
      .then(function (response) {
        const account = response.data;
        console.log(
          `Account: ${account.id}, ${account.balance}, ${account.current_year_expenses}`
        );
        if (account) {
          accountData = {
            balance: account.balance + job.variables.sum,
            current_year_expenses: account.current_year_expenses + 1,
          };
        } else {
          console.log("Account not found");
        }
      })
      .catch(function (error) {
        return job.error(`DBnotReachable`);
      });

    console.log(
      `accountData: ${accountData.balance}, ${accountData.current_year_expenses}`
    );

    return await axios
      .patch(`${baseURL}/accounts/${job.variables.employee_id}`, accountData)
      .then(function (response) {
        console.log("Account balance updated successfully:", response.data);
        return job.complete();
      })
      .catch(function (error) {
        return job.error(`DBnotReachable`);
      });
  },
});

zbc.createWorker<ProcessPayload, {}, Partial<ProcessPayload>>({
  taskType: "get_current_year_expenses",
  taskHandler: async (job) => {
    console.log(`Spesen pro Jahr abfragen...`);
    return await axios
      .get(`${baseURL}/accounts/${job.variables.employee_id}`)
      .then(function (response) {
        const account = response.data;
        console.log(
          `Account: ${account.id}, ${account.balance}, ${account.current_year_expenses}`
        );
        if (account) {
          const current_year_expenses = account.current_year_expenses;
          return job.complete({ current_year_expenses });
        } else {
          console.log("Account not found");
          return job.error(`Account not found`);
        }
      })
      .catch(function (error) {
        return job.error(`DBnotReachable`);
      });
  },
});
