paypalConf =
  host: "api.sandbox.paypal.com"
  clientId: "pHQcZ1cH0lnX5Mub4MGzo_-FH6witB3_2zuRYgvUFxMHFH6wiAe3zCRDqatu3"
  clientSecret:"Xk7-EDJqERAU5up6wjeVoRE6WM2OoIsUT3ouxVRKUmjX38b4k0-q6t_UHei"


  Meteor.methods
  'getPaypalToken': ->
    isTokenValid = 0
    token = PaypalTokens.findOne({ timestamp: { $exists: true } },
      { sort: { timestamp: -1 } })

    if token?
      isTokenValid = Math.ceil((new Date().getTime() - token.timestamp) / 1000)

    # is the token invalid?
    if isTokenValid is 0 or isTokenValid > token.expires_in
      auth = paypalConf['clientId'] + ':' +
             paypalConf['clientSecret']

      token = EJSON.parse(
        Meteor.http.post('https://api.sandbox.paypal.com/v1/oauth2/token',
          headers:
            'Accept': 'application/json'
            'Accept-Language': 'en_US'
          auth: auth
          params:
            'grant_type': 'client_credentials'
        ).content)

      token['timestamp'] = new Date().getTime()

      # we insert the new valid token to retrieve it later
      PaypalTokens.insert token

    return token

  'createPaypalPayment': (product) ->
    token = Meteor.call 'getPaypalToken'

    payment =
      intent: 'sale'
      payer:
        payment_method: 'paypal'

      redirect_urls:
        return_url: 'http://localhost:3000/dashboard/payment/paypal/execute'
        cancel_url: 'http://localhost:3000/dashboard'

      transactions: [
        item_list:
          'items': [
            'name': product.name,
            'price': product.price,
            'currency': 'USD',
            'quantity': 1
          ]

        amount:
          total: product.price
          currency: 'USD'

        description: product.description
      ]

    res = Meteor.http.post 'https://api.sandbox.paypal.com/v1/payments/payment',
      headers:
        Authorization: 'Bearer ' + token.access_token
        'Content-Type': 'application/json'
      data: payment

    res.data['userId'] = @userId

    # we insert the payment details (for the payment id during execution)
    PaypalPayments.insert res.data

    return res.data

  'executePaypalPayment': (payerId) ->
    payment = PaypalPayments.findOne({ userId: @userId },
      { sort: { 'create_time': -1 } })

    token = Meteor.call 'getPaypalToken'

    url = 'https://api.sandbox.paypal.com/v1/payments/payment/' +
           payment.id + '/execute'

    res = Meteor.http.post url,
      headers:
        Authorization: 'Bearer ' + token.access_token
        'Content-Type': 'application/json'
      data:
        payer_id: payerId

    payment = res.data
    payment['userId'] = @userId

    if payment.state in ['approved' , 'pending']  # Be careful, in production the payment state is "pending"
      # we insert the sucessful payment here
      PaypalPayments.insert payment

    return if payment.state is 'approved' then true else false  