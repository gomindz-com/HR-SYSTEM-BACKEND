import ModemPay from "modem-pay";

const modempay = new ModemPay(process.env.MODEM_PAY_API_KEY);

export default modempay;
